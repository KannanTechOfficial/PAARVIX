/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { ColumnSchema, ColumnType, TableSchema } from '@paarvix/shared';
import { ColumnTracker, normalise } from './infer';
import { extendHeader, readHeader, readWorkbook, type Limits } from './workbook';

export const SCHEMA = 'paarvix_data';
/** Generated names only. Anything else never reaches SQL. */
export const TABLE_ID = /^t_[a-z0-9]+$/;
const PG_TYPE: Record<ColumnType, string> = { number: 'numeric', date: 'timestamptz', boolean: 'boolean', text: 'text' };
const MAX_PARAMS = 60000;
const MAX_BATCH = 1000;
const MAX_BATCH_BYTES = 8 * 1024 * 1024; // rough size of one INSERT's values, so long text cannot build a huge message

export function tableId(storageName: string): string {
  const id = storageName.startsWith(`${SCHEMA}.`) ? storageName.slice(SCHEMA.length + 1) : '';
  if (!TABLE_ID.test(id)) throw new Error('Refusing to touch a table that Paarvix did not create');
  return id;
}

export interface SheetPlan {
  name: string;
  header: string[];
  types: ColumnType[];
  rows: number;
}

/** The SQLSTATE of an error that came from the database server, never a Node system error such as EPIPE or EBUSY. */
export function sqlState(e: unknown): string | undefined {
  const err = e as { code?: unknown; severity?: unknown };
  return typeof err?.code === 'string' && typeof err.severity === 'string' && /^[0-9A-Z]{5}$/.test(err.code) ? err.code : undefined;
}

/** Raised for problems that are ours; its message is safe to log. Driver errors can quote file content, so they are not. */
export class ImportFailure extends Error {}


/** Loads one sheet into a new table and records it in data_tables. Replaceable so tests can inject failures. */
export type LoadSheet = (client: Client, datasourceId: string, plan: SheetPlan, rows: AsyncIterable<unknown[]>) => Promise<TableSchema>;

export interface ImportOptions {
  limits?: Partial<Limits>;
  /** Folder for the reader's temp files. */
  workRoot?: string;
}

/**
 * The whole import for one data source, on its own connection: read the file twice (types, then rows) and
 * swap the new tables in with one transaction. If the connection dies, Postgres rolls the transaction back.
 * The caller supplies a Client that is not connected yet; it is connected after the first pass so a long
 * read holds no connection.
 */
export async function runImport(
  client: Client,
  datasourceId: string,
  path: string,
  options: ImportOptions = {},
  load: LoadSheet = loadSheet,
): Promise<TableSchema[]> {
  // Pass 1: infer types and the true width of each sheet without keeping rows.
  const plans: SheetPlan[] = [];
  for await (const sheet of readWorkbook(path, options.limits, options.workRoot)) {
    const header = await readHeader(sheet.rows);
    const trackers = header.map(() => new ColumnTracker());
    let rows = 0;
    for await (const row of sheet.rows) {
      // Data wider than the header (a title row came first) still gets columns.
      while (trackers.length < row.length) trackers.push(new ColumnTracker());
      trackers.forEach((t, i) => t.add(row[i]));
      rows++;
    }
    plans.push({ name: sheet.name, header: extendHeader(header, trackers.length), types: trackers.map((t) => t.type()), rows });
  }

  // Pass 2: load into new tables inside one transaction. Writers of one data source take turns.
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [datasourceId]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    const old = await client.query('SELECT storage_name FROM data_tables WHERE datasource_id = $1', [datasourceId]);
    await client.query('DELETE FROM data_tables WHERE datasource_id = $1', [datasourceId]);

    const tables: TableSchema[] = [];
    for await (const sheet of readWorkbook(path, options.limits, options.workRoot)) {
      const plan = plans[tables.length];
      if (!plan || plan.name !== sheet.name) throw new ImportFailure('The file changed while it was being imported');
      await readHeader(sheet.rows); // the header row is not data
      const table = await load(client, datasourceId, plan, sheet.rows);
      if (table.rowCount !== plan.rows) throw new ImportFailure('A sheet had a different number of rows on the second read');
      tables.push(table);
    }
    // A reader that lost a sheet must never commit a partial import and drop the old data.
    if (tables.length !== plans.length) throw new ImportFailure('The second read found fewer sheets than the first');
    for (const { storage_name } of old.rows) {
      await client.query(`DROP TABLE IF EXISTS ${SCHEMA}."${tableId(storage_name)}"`); // last, so queries rarely wait on it
    }
    await client.query('COMMIT');
    return tables;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export const loadSheet: LoadSheet = async (client, datasourceId, plan, rows) => {
  const id = `t_${randomBytes(12).toString('hex')}`;
  if (!TABLE_ID.test(id)) throw new Error('Generated table name is invalid');
  const columns: ColumnSchema[] = plan.header.map((name, n) => ({ name, type: plan.types[n], storageName: `c${n}` }));
  const names = columns.map((c) => c.storageName);
  await client.query(`CREATE TABLE ${SCHEMA}."${id}" (${columns.map((c) => `${c.storageName} ${PG_TYPE[c.type]}`).join(', ')})`);

  const width = columns.length;
  const batchSize = Math.min(MAX_BATCH, Math.floor(MAX_PARAMS / width));
  const head = `INSERT INTO ${SCHEMA}."${id}" (${names.join(', ')}) VALUES `;
  let batch: unknown[] = [];
  let bytes = 0;
  let count = 0;
  const flush = async () => {
    if (!batch.length) return;
    const n = batch.length / width;
    const tuples = Array.from({ length: n }, (_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(', ')})`);
    await client.query(head + tuples.join(', '), batch);
    batch = [];
    bytes = 0;
  };
  for await (const row of rows) {
    for (let c = 0; c < width; c++) {
      const v = normalise(row[c], plan.types[c]);
      batch.push(v);
      bytes += typeof v === 'string' ? v.length * 3 : 16; // a string can take 3 bytes per character
    }
    count++;
    if (batch.length / width >= batchSize || bytes >= MAX_BATCH_BYTES) await flush();
  }
  await flush();

  const storageName = `${SCHEMA}.${id}`;
  await client.query(
    `INSERT INTO data_tables (id, datasource_id, name, storage_name, columns, row_count, synced_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
    [randomUUID(), datasourceId, plan.name, storageName, JSON.stringify(columns), count],
  );
  return { name: plan.name, storageName, columns, rowCount: count };
};
