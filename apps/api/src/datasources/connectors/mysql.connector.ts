/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { createConnection } from 'mysql2/promise';
import type { ColumnType, QueryResult, QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';
import { compileQuery, MAX_ROWS, QUERY_TIMEOUT_MS, toQueryResult, trimRows } from '../query-compiler';
import { assertReadOnlySql } from '../sql-guard';
import type { Connector, LoadedDatasource } from './connector';

const NUMBER_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'numeric', 'float', 'double', 'real']);

function columnType(dataType: string): ColumnType {
  const t = dataType.toLowerCase();
  if (NUMBER_TYPES.has(t)) return 'number';
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'date';
  return 'text';
}

/** Server messages that only describe the user's own SQL or the connection. Anything else may quote row data. */
const SAFE_CODES = new Set([
  'ER_PARSE_ERROR',
  'ER_NO_SUCH_TABLE',
  'ER_BAD_TABLE_ERROR',
  'ER_BAD_FIELD_ERROR',
  'ER_DUP_FIELDNAME',
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_TABLEACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_NONUNIQ_TABLE',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
]);

function userError(err: any): Error {
  if (err instanceof BadRequestException) return err;
  // 3024 is MySQL max_execution_time, 1969 is MariaDB max_statement_time.
  if (err?.errno === 3024 || err?.errno === 1969) return new BadRequestException(`Query stopped after ${QUERY_TIMEOUT_MS / 1000} seconds`);
  if (SAFE_CODES.has(err?.code)) return new BadRequestException(String(err.sqlMessage ?? err.message));
  return new BadRequestException(`MySQL error ${String(err?.code ?? 'unknown')}`);
}

async function connect(ds: LoadedDatasource) {
  const cfg = ds.config as { host: string; port?: number; database: string; user: string; password?: string; ssl?: boolean };
  return createConnection({
    host: cfg.host,
    port: cfg.port ?? 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: true } : undefined,
    multipleStatements: false,
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true, // ids above 2^53 come back as exact strings instead of rounded numbers
    connectTimeout: 10000,
  });
}

/** Runs one statement in a read-only transaction with a time limit. Works on MySQL and MariaDB. */
async function readOnly(ds: LoadedDatasource, text: string, values: unknown[]) {
  let c: Awaited<ReturnType<typeof connect>> | undefined;
  try {
    c = await connect(ds);
    const [versionRows] = await c.query('SELECT VERSION() AS v');
    const isMaria = /mariadb/i.test(String((versionRows as { v: string }[])[0]?.v));
    // Constants only: SET cannot take bound values.
    await c.query(isMaria ? `SET SESSION max_statement_time = ${QUERY_TIMEOUT_MS / 1000}` : `SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
    await c.query('START TRANSACTION READ ONLY');
    // Prepared statements run exactly one statement, and values are always bound.
    const [rows, fields] = await c.execute(text, values as any[]);
    await c.query('ROLLBACK');
    return { rows: rows as Record<string, unknown>[], fields: (fields as { name: string }[]).map((f) => f.name) };
  } catch (err) {
    throw userError(err);
  } finally {
    await c?.end().catch(() => c?.destroy());
  }
}

@Injectable()
export class MysqlConnector implements Connector {
  readonly type = 'mysql' as const;
  readonly capabilities = { supportsRawSql: true, supportsWrite: false } as const;
  readonly secretFields = ['password'];

  validateConfig(raw: unknown): Record<string, unknown> {
    const { host, port, database, user, password, ssl } = (raw ?? {}) as Record<string, any>;
    if (!host || !database || !user) {
      throw new BadRequestException('Host, database and user are required');
    }
    const p = port ? Number(port) : 3306;
    if (!Number.isInteger(p) || p < 1 || p > 65535) throw new BadRequestException('Port is not valid');
    return { host, port: p, database, user, ssl: !!ssl, ...(password ? { password } : {}) };
  }

  async testConnection(ds: LoadedDatasource): Promise<void> {
    await readOnly(ds, 'SELECT 1', []);
  }

  async discoverSchema(ds: LoadedDatasource): Promise<TableSchema[]> {
    const database = String(ds.config.database);
    // Aliases because MySQL 8 returns information_schema column names in upper case.
    const res = await readOnly(
      ds,
      `SELECT table_name AS t, column_name AS c, data_type AS d FROM information_schema.columns
       WHERE table_schema = ? ORDER BY table_name, ordinal_position`,
      [database],
    );
    const tables = new Map<string, TableSchema>();
    for (const r of res.rows) {
      const name = String(r.t);
      let t = tables.get(name);
      if (!t) {
        t = { name, storageName: `${database}.${name}`, columns: [] };
        tables.set(name, t);
      }
      t.columns.push({ name: String(r.c), type: columnType(String(r.d)) });
    }
    return [...tables.values()];
  }

  async query(ds: LoadedDatasource, spec: QuerySpec, ctx: SecurityContext): Promise<QueryResult> {
    const table = (await this.discoverSchema(ds)).find((t) => t.name === spec.table);
    if (!table) throw new BadRequestException('table no longer exists');
    const compiled = compileQuery(spec, table, 'mysql', ctx);
    const res = await readOnly(ds, compiled.text, compiled.values);
    return toQueryResult(res.rows, compiled);
  }

  async runSql(ds: LoadedDatasource, sql: string, values: unknown[], _ctx: SecurityContext): Promise<QueryResult> {
    const text = assertReadOnlySql(sql);
    const res = await readOnly(ds, `SELECT * FROM (${text}) AS paarvix_q LIMIT ${MAX_ROWS + 1}`, values);
    return { fields: res.fields, ...trimRows(res.rows) };
  }
}
