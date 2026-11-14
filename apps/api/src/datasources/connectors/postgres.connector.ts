/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from 'pg';
import type { ColumnType, QueryResult, QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';
import { compileQuery, MAX_ROWS, QUERY_TIMEOUT_MS, toQueryResult, trimRows } from '../query-compiler';
import { assertReadOnlySql } from '../sql-guard';
import type { Connector, LoadedDatasource } from './connector';

const NUMBER_TYPES = new Set(['smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision', 'money']);

function columnType(dataType: string): ColumnType {
  if (NUMBER_TYPES.has(dataType)) return 'number';
  if (dataType === 'boolean') return 'boolean';
  if (dataType === 'date' || dataType.startsWith('timestamp')) return 'date';
  return 'text';
}

function client(ds: LoadedDatasource) {
  const cfg = ds.config as { host: string; port?: number; database: string; user: string; password?: string; ssl?: boolean };
  return new Client({
    host: cfg.host,
    port: cfg.port ?? 5432,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 10000,
  });
}

/** Runs one statement in a read-only transaction with a timeout, and fetches one row past the cap. */
/**
 * Turns a PostgreSQL or network error into a message an admin can act on, as a 400.
 * Only known cases pass the database's own text through; anything else gets its code only.
 */
function pgError(err: any): Error {
  if (err instanceof BadRequestException) return err;
  const msg = String(err?.message ?? '');
  const code = String(err?.code ?? '');
  if (/does not support SSL/i.test(msg)) return new BadRequestException('This database does not use SSL. Remove the source and add it again with SSL turned off.');
  if (/SSL.*(required|off)|no pg_hba\.conf entry.*SSL off/i.test(msg)) return new BadRequestException('This database requires SSL. Add the source again with SSL turned on.');
  if (code === 'ECONNREFUSED') return new BadRequestException('Nothing is answering at that host and port. Check the host, the port, and that the database is running.');
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new BadRequestException('That host name could not be found. Check the host.');
  if (code === 'ETIMEDOUT' || /timeout expired/i.test(msg)) return new BadRequestException('The database did not answer in time. Check the host and any firewall.');
  if (code === '28P01') return new BadRequestException('The user name or password is wrong.');
  if (code === '28000') return new BadRequestException('This user may not sign in to this database. Check the user and the server\'s access rules.');
  if (code === '3D000') return new BadRequestException('There is no database with that name on this server.');
  if (code === '42501') return new BadRequestException('This user cannot read that table. Grant it SELECT, or use another user.');
  if (code === '57014') return new BadRequestException(`Query stopped after ${QUERY_TIMEOUT_MS / 1000} seconds`);
  // Mistakes in the query itself: the database's own explanation helps the person fix it.
  if (/^(42|22)/.test(code)) return new BadRequestException(msg.slice(0, 300));
  return new BadRequestException(`PostgreSQL error ${code || 'unknown'}`);
}

async function readOnly(ds: LoadedDatasource, text: string, values: unknown[]) {
  const c = client(ds);
  try {
    await c.connect();
    await c.query('BEGIN READ ONLY');
    await c.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    // Extended protocol runs exactly one statement.
    const res = await c.query({ text, values, queryMode: 'extended' } as any);
    await c.query('ROLLBACK');
    return res;
  } catch (err) {
    throw pgError(err);
  } finally {
    await c.end().catch(() => undefined);
  }
}

@Injectable()
export class PostgresConnector implements Connector {
  readonly type = 'postgres' as const;
  readonly capabilities = { supportsRawSql: true, supportsWrite: false } as const;
  readonly secretFields = ['password'];

  validateConfig(raw: unknown): Record<string, unknown> {
    const { host, port, database, user, password, ssl } = (raw ?? {}) as Record<string, any>;
    if (!host || !database || !user) {
      throw new BadRequestException('Host, database and user are required');
    }
    return {
      host,
      port: port ? Number(port) : 5432,
      database,
      user,
      ssl: !!ssl,
      ...(password ? { password } : {}),
    };
  }

  async testConnection(ds: LoadedDatasource): Promise<void> {
    const c = client(ds);
    try {
      await c.connect();
      await c.query('SELECT 1');
    } catch (err) {
      throw pgError(err);
    } finally {
      await c.end().catch(() => undefined);
    }
  }

  async discoverSchema(ds: LoadedDatasource): Promise<TableSchema[]> {
    const res = await readOnly(
      ds,
      `SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         -- Only what this login may read, so no one is offered a table that would fail.
         -- CASE runs in order: the table check would itself fail in a schema the login cannot use.
         AND CASE WHEN has_schema_privilege(table_schema, 'USAGE')
                  THEN has_table_privilege(quote_ident(table_schema) || '.' || quote_ident(table_name), 'SELECT')
                  ELSE false END
       ORDER BY table_schema <> 'public', table_schema, table_name, ordinal_position`,
      [],
    );
    const tables = new Map<string, TableSchema>();
    for (const r of res.rows) {
      const storageName = `${r.table_schema}.${r.table_name}`;
      let t = tables.get(storageName);
      if (!t) {
        t = { name: r.table_schema === 'public' ? r.table_name : storageName, storageName, columns: [] };
        tables.set(storageName, t);
      }
      t.columns.push({ name: r.column_name, type: columnType(r.data_type) });
    }
    return [...tables.values()];
  }

  async query(ds: LoadedDatasource, spec: QuerySpec, ctx: SecurityContext): Promise<QueryResult> {
    const table = (await this.discoverSchema(ds)).find((t) => t.name === spec.table);
    if (!table) throw new BadRequestException('table no longer exists');
    const compiled = compileQuery(spec, table, 'postgres', ctx);
    const res = await readOnly(ds, compiled.text, compiled.values);
    return toQueryResult(res.rows, compiled);
  }

  async runSql(ds: LoadedDatasource, sql: string, values: unknown[], _ctx: SecurityContext): Promise<QueryResult> {
    const text = assertReadOnlySql(sql);
    const res = await readOnly(ds, `SELECT * FROM (${text}) AS paarvix_q LIMIT ${MAX_ROWS + 1}`, values);
    return { fields: res.fields.map((f: { name: string }) => f.name), ...trimRows(res.rows) };
  }
}
