/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException, HttpException, Injectable, InternalServerErrorException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { Pool, types, type PoolClient } from 'pg';
import type { QueryResult, TableSchema } from '@paarvix/shared';
import { QUERY_TIMEOUT_MS, toQueryResult, type CompiledQuery } from '../query-compiler';
import { ImportFailure, SCHEMA, sqlState, tableId, type ImportOptions } from './import-job';
import type { WorkerError, WorkerInput, WorkerMessage } from './import-worker';
import { sweepTempFolders } from './workbook';

export { sqlState };

const defaultConnectionString = () => process.env.DATABASE_URL || 'postgresql://paarvix:paarvix_secret@localhost:5432/paarvix';
const DEFAULT_HEAP_MB = 512;
const DEFAULT_DEADLINE_MS = 5 * 60 * 1000;
const NUMERIC_OID = 1700;
const INT8_OID = 20;

/** A number when no precision is lost, else the exact text. avg() arrives as '1.5000000000000000'. */
export function safeNumber(raw: string): number | string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const s = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  if (/^-?\d+$/.test(s)) return Number.isSafeInteger(n) ? n : raw;
  const whole = s.replace(/^-/, '').split('.')[0].replace(/^0+/, '');
  return whole.length <= 15 ? n : raw; // the fraction may round at the last digit, which is how a double works
}

const resultTypes = {
  getTypeParser: (oid: number, format?: 'text' | 'binary') =>
    oid === NUMERIC_OID || oid === INT8_OID ? safeNumber : types.getTypeParser(oid, format as 'text'),
};

export interface ReplaceOptions {
  /** Lowers the reader's limits. For tests. */
  limits?: ImportOptions['limits'];
  heapMb?: number;
  deadlineMs?: number;
}

@Injectable()
export class TableStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TableStore.name);
  private readonly connectionString = defaultConnectionString();
  private readonly pool = new Pool({
    connectionString: this.connectionString,
    max: 4,
    connectionTimeoutMillis: 10000,
  });

  constructor() {
    this.pool.on('error', (e) => this.logger.warn(`Idle database connection failed: ${e.message}`));
  }

  async onModuleInit() {
    await sweepTempFolders().catch((e) => this.logger.warn(`Could not clean old import folders: ${(e as Error).message}`));
    try {
      await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    } catch (e) {
      // The database may still be starting. replaceAll creates the schema again when it needs it.
      this.logger.warn(`Could not prepare ${SCHEMA}: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Checks a connection out and keeps a database restart from crashing the process while it is in use. */
  private async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const onError = (e: Error) => this.logger.warn(`Database connection failed: ${e.message}`);
    client.on('error', onError);
    let discard = false;
    try {
      return await fn(client);
    } catch (e) {
      // Only a failure that is not an ordinary SQL or application error leaves the connection suspect.
      discard = !(e instanceof HttpException || e instanceof ImportFailure || sqlState(e));
      throw e;
    } finally {
      client.off('error', onError);
      client.release(discard ? true : undefined);
    }
  }

  /** One transaction. Writers of the same data source take turns, so imports and removals cannot interleave. */
  private tx<T>(datasourceId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [datasourceId]);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      }
    });
  }

  /** Turns a failure reported by the import worker into the error callers see. */
  private failure(e: WorkerError): Error {
    if (e.kind === 'bad') return new BadRequestException(e.message);
    // These messages are ours and name no file content, so they are safe to log.
    const code = e.kind === 'other' ? e.sqlState : undefined;
    const cause = e.kind === 'other' ? (code ? `database error ${code}` : 'unexpected error') : e.message;
    this.logger.error(`Import failed: ${cause}`);
    // Classes 22, 23 and 54 are about the data itself (bad value, constraint, too wide).
    if (code && /^(22|23|54)/.test(code)) {
      return new BadRequestException('The data could not be imported. Please check the file and try again');
    }
    return new InternalServerErrorException('The import failed. Please try again');
  }

  /** Imports wait their turn: one at a time bounds peak memory and keeps queued imports from holding connections. */
  private tail: Promise<unknown> = Promise.resolve();

  /**
   * Replaces every table of a data source with the sheets of an .xlsx. New tables, the DataTable rows and the
   * drop of the old tables commit together, so a failed import leaves the previous data untouched.
   * The import runs in a child process with a heap limit and a deadline: a file that exhausts memory or time
   * costs only that process, and its database connection closing rolls the transaction back.
   */
  replaceAll(datasourceId: string, path: string, options: ReplaceOptions = {}): Promise<TableSchema[]> {
    const run = () => this.importInWorker(datasourceId, path, options);
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private async importInWorker(datasourceId: string, path: string, options: ReplaceOptions): Promise<TableSchema[]> {
    const workRoot = await mkdtemp(join(tmpdir(), 'paarvix-xlsx-job-')); // removed below, whatever happens to the worker
    try {
      const input: WorkerInput = { connectionString: this.connectionString, datasourceId, path, limits: options.limits, workRoot };
      const message = await this.runWorker(input, options);
      if (!message.ok) throw this.failure(message.error);
      return message.tables;
    } finally {
      await rm(workRoot, { recursive: true, force: true });
    }
  }

  private runWorker(input: WorkerInput, options: ReplaceOptions): Promise<WorkerMessage> {
    return new Promise((resolve, reject) => {
      const lost = (cause: string) => {
        this.logger.error(`Import process stopped: ${cause}`);
        reject(new BadRequestException('This file is too large to read'));
      };
      // Compiled code runs the .js next to this file. Under ts-jest only the .ts exists, so it is transpiled on the fly.
      const ts = __filename.endsWith('.ts');
      const file = join(__dirname, ts ? 'import-worker.ts' : 'import-worker.js');
      const child = fork(file, [], {
        execArgv: [
          `--max-old-space-size=${options.heapMb ?? DEFAULT_HEAP_MB}`,
          ...(ts ? ['--no-experimental-strip-types', '--require', require.resolve('ts-node/register/transpile-only')] : []),
        ],
        env: ts
          ? {
              ...process.env,
              TS_NODE_PROJECT: join(__dirname, '../../../tsconfig.json'),
              TS_NODE_COMPILER_OPTIONS: JSON.stringify({ rootDir: join(__dirname, '../../..') }),
            }
          : process.env,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], // a V8 abort prints a long trace; the cause is logged below
      });
      let message: WorkerMessage | undefined;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, options.deadlineMs ?? DEFAULT_DEADLINE_MS);
      child.on('message', (m: WorkerMessage) => (message = m));
      child.on('error', (e) => this.logger.error(`Import process error: ${(e as Error).message}`));
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        if (message) return resolve(message);
        lost(timedOut ? 'deadline passed' : signal ? `signal ${signal}` : `exit code ${code}`);
      });
      // The connection string goes over IPC, not the command line, where other users could read it.
      child.send(input);
    });
  }

  async tables(datasourceId: string): Promise<TableSchema[]> {
    const res = await this.pool.query(
      'SELECT name, storage_name, columns, row_count FROM data_tables WHERE datasource_id = $1 ORDER BY name',
      [datasourceId],
    );
    return res.rows.map((r) => ({ name: r.name, storageName: r.storage_name, rowCount: r.row_count, columns: r.columns }));
  }

  /** Runs a compiled query read-only with the shared time and row limits. */
  async run(compiled: CompiledQuery): Promise<QueryResult> {
    return this.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL transaction_read_only = on');
        await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
        // Extended protocol runs exactly one statement.
        const res = await client.query({ text: compiled.text, values: compiled.values, types: resultTypes, queryMode: 'extended' } as any);
        await client.query('ROLLBACK');
        return toQueryResult(res.rows, compiled);
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      }
    });
  }

  /** Drops every imported table of a data source and forgets them. */
  async dropAll(datasourceId: string): Promise<void> {
    await this.tx(datasourceId, async (client) => {
      const res = await client.query('SELECT storage_name FROM data_tables WHERE datasource_id = $1', [datasourceId]);
      await client.query('DELETE FROM data_tables WHERE datasource_id = $1', [datasourceId]);
      for (const { storage_name } of res.rows) {
        await client.query(`DROP TABLE IF EXISTS ${SCHEMA}."${tableId(storage_name)}"`);
      }
    });
  }
}
