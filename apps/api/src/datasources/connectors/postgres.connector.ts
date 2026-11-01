/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
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
async function readOnly(ds: LoadedDatasource, text: string, values: unknown[]) {
  const c = client(ds);
  await c.connect();
  try {
    await c.query('BEGIN READ ONLY');
    await c.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    // Extended protocol runs exactly one statement.
    const res = await c.query({ text, values, queryMode: 'extended' } as any);
    await c.query('ROLLBACK');
    return res;
  } finally {
    await c.end();
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
    await c.connect();
    try {
      await c.query('SELECT 1');
    } finally {
      await c.end();
    }
  }

  async discoverSchema(ds: LoadedDatasource): Promise<TableSchema[]> {
    const res = await readOnly(
      ds,
      `SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name, ordinal_position`,
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
