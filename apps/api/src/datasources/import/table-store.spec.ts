/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

// Needs a disposable database with the Prisma schema pushed, so it only runs when you point it at one:
//   PAARVIX_TEST_DATABASE_URL=postgresql://... npm test -- table-store
// `npm test` alone skips it.

import { readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { Client, Pool } from 'pg';
import type { SecurityContext } from '@paarvix/shared';
import { compileQuery } from '../query-compiler';
import { loadSheet, runImport } from './import-job';
import { TableStore, safeNumber, sqlState } from './table-store';

// Each import starts a worker thread, and under ts-jest it transpiles its sources first.
jest.setTimeout(60000);

const url = process.env.PAARVIX_TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url; // before any TableStore exists, so none can reach a different database
const ctx: SecurityContext = { userId: 'u', role: 'ADMIN', tenantId: null, rowFilters: [] };

describe('sqlState', () => {
  it('reads codes from the database server only, never Node system errors', () => {
    expect(sqlState(Object.assign(new Error('x'), { code: '22P02', severity: 'ERROR' }))).toBe('22P02');
    expect(sqlState(Object.assign(new Error('x'), { code: 'EPIPE' }))).toBeUndefined();
    expect(sqlState(Object.assign(new Error('x'), { code: 'EBUSY' }))).toBeUndefined();
    expect(sqlState(new Error('x'))).toBeUndefined();
  });
});

describe('safeNumber', () => {
  it.each([
    ['1.5000000000000000', 1.5], // avg() output
    ['63750.2500000000000000', 63750.25],
    ['0.30000000000000004', 0.30000000000000004],
    ['-12.50', -12.5],
    ['100', 100],
    ['100.000', 100],
    ['0', 0],
    ['9007199254740993', '9007199254740993'], // beyond a safe integer
    ['1234567890123456.5', '1234567890123456.5'], // more than 15 whole digits
    ['NaN', 'NaN'],
  ])('%s', (input, expected) => {
    expect(safeNumber(input)).toBe(expected);
  });
});

describe('TableStore import worker (no database needed)', () => {
  let dir: string;
  let path: string;
  let store: TableStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'paarvix-store-'));
    path = join(dir, 'small.xlsx');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('S').addRow(['a']).worksheet.addRow([1]);
    await wb.xlsx.writeFile(path);
    store = new TableStore();
  });
  afterAll(async () => {
    await store.onModuleDestroy();
    await rm(dir, { recursive: true, force: true });
  });

  // These stop the worker before it reaches the database, so they need none. A real memory bomb is
  // exercised against the compiled worker by the probes in the task report.
  it('rejects plainly when the deadline passes, and removes the worker folder', async () => {
    const before = readdirSync(tmpdir()).filter((f) => f.startsWith('paarvix-xlsx-job-'));
    await expect(store.replaceAll('ds', path, { deadlineMs: 20 })).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'This file is too large to read',
    });
    expect(readdirSync(tmpdir()).filter((f) => f.startsWith('paarvix-xlsx-job-'))).toEqual(before);
  });

  it('rejects plainly when the worker runs out of memory, and the process carries on', async () => {
    await expect(store.replaceAll('ds', path, { heapMb: 4 })).rejects.toThrow('This file is too large to read');
    await expect(store.replaceAll('ds', path, { deadlineMs: 20 })).rejects.toThrow('This file is too large to read'); // the queue kept going
  });

  it('maps worker failures to errors with no file or driver text', () => {
    const failure = (e: unknown) => (store as unknown as { failure(e: unknown): Error }).failure(e);
    expect(failure({ kind: 'bad', message: 'This file has no data' })).toMatchObject({ constructor: BadRequestException, message: 'This file has no data' });
    expect(failure({ kind: 'other', sqlState: '22P02' }).message).toBe('The data could not be imported. Please check the file and try again');
    expect(failure({ kind: 'other', sqlState: '23505' })).toBeInstanceOf(BadRequestException);
    for (const e of [{ kind: 'other' }, { kind: 'other', sqlState: '57P01' }, { kind: 'failure', message: 'disk full row 5' }, { kind: 'unsupported', message: 'x' }]) {
      const err = failure(e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).toBe('The import failed. Please try again');
    }
  });
});

(url ? describe : describe.skip)('TableStore (needs PAARVIX_TEST_DATABASE_URL)', () => {
  let dir: string;
  let pool: Pool;
  let store: TableStore;
  let userId: string;
  let ds1: string;
  let ds2: string;
  let n = 0;

  async function build(fill: (wb: ExcelJS.Workbook) => void): Promise<string> {
    const wb = new ExcelJS.Workbook();
    fill(wb);
    const path = join(dir, `book-${n++}.xlsx`);
    await wb.xlsx.writeFile(path);
    return path;
  }
  const physical = async () =>
    (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'paarvix_data' ORDER BY 1")).rows.map(
      (r) => r.table_name as string,
    );
  const rowsOf = async (t: { name: string; storageName?: string; columns: { name: string }[] }, extra = {}) =>
    store.run(compileQuery({ table: t.name, ...extra }, t as never, 'postgres', ctx));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dir = await mkdtemp(join(tmpdir(), 'paarvix-store-'));
    pool = new Pool({ connectionString: url });
    store = new TableStore();
    await store.onModuleInit();
    userId = randomUUID();
    ds1 = randomUUID();
    ds2 = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, name, password_hash, updated_at) VALUES ($1, $2, 'T', 'x', now())`,
      [userId, `${userId}@example.invalid`],
    );
    for (const id of [ds1, ds2]) {
      await pool.query(`INSERT INTO datasources (id, name, type, created_by, updated_at) VALUES ($1, 'd', 'excel', $2, now())`, [id, userId]);
    }
  });

  afterAll(async () => {
    await store.dropAll(ds1);
    await store.dropAll(ds2);
    await pool.query('DELETE FROM datasources WHERE id = ANY($1)', [[ds1, ds2]]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await store.onModuleDestroy();
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  });

  it('creates typed tables and reads them back', async () => {
    const tamil = 'மதிப்பெண் பட்டியல்';
    const path = await build((wb) => {
      const a = wb.addWorksheet(tamil);
      a.addRow(['Code', 'Amount', 'Day', 'Done', 'Note']);
      a.addRow(['00123', '₹1,25,000', '15-08-2026', true, 'a']);
      a.addRow(['00456', 2500.5, '01/02/2026', false, null]);
      wb.addWorksheet('Other').addRow(['x']).worksheet.addRow([1]);
    });
    const tables = await store.replaceAll(ds1, path);
    expect(tables.map((t) => [t.name, t.rowCount])).toEqual([[tamil, 2], ['Other', 1]]);
    expect(tables[0].storageName).toMatch(/^paarvix_data\.t_[a-z0-9]+$/);
    expect(tables[0].columns.map((c) => [c.name, c.type, c.storageName])).toEqual([
      ['Code', 'text', 'c0'],
      ['Amount', 'number', 'c1'],
      ['Day', 'date', 'c2'],
      ['Done', 'boolean', 'c3'],
      ['Note', 'text', 'c4'],
    ]);
    const stored = (await store.tables(ds1)).find((t) => t.name === tamil)!;
    const res = await rowsOf(stored, { orderBy: [{ column: 'Code', dir: 'asc' }] });
    expect(res.rows).toEqual([
      { Code: '00123', Amount: 125000, Day: new Date(Date.UTC(2026, 7, 15)), Done: true, Note: 'a' },
      { Code: '00456', Amount: 2500.5, Day: new Date(Date.UTC(2026, 1, 1)), Done: false, Note: null },
    ]);
    expect(res.truncated).toBe(false);
  });

  it('sums numeric columns to numbers', async () => {
    const t = (await store.tables(ds1)).find((x) => x.name !== 'Other')!;
    const res = await rowsOf(t, { aggregates: [{ fn: 'sum', column: 'Amount', as: 'total' }, { fn: 'count', as: 'n' }] });
    expect(res.rows).toEqual([{ total: 127500.5, n: 2 }]);
    const avg = await rowsOf(t, { aggregates: [{ fn: 'avg', column: 'Amount', as: 'mean' }] });
    expect(avg.rows).toEqual([{ mean: 63750.25 }]); // numeric avg comes back as a number, not '63750.2500000000000000'
  });

  it('caps rows and marks truncated', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('Big');
      ws.addRow(['n']);
      for (let i = 0; i < 10050; i++) ws.addRow([i]);
    });
    const [big] = await store.replaceAll(ds2, path);
    expect(big.rowCount).toBe(10050);
    const all = await rowsOf(big);
    expect(all.rows).toHaveLength(10000);
    expect(all.truncated).toBe(true);
    const five = await rowsOf(big, { limit: 5 });
    expect(five.rows).toHaveLength(5);
    expect(five.truncated).toBe(true);
    expect((await rowsOf(big, { limit: 10050 })).rows).toHaveLength(10000);
  });

  it('runs read-only with a 30 second timeout', async () => {
    const t = (await store.tables(ds1))[0];
    const del = { text: `DELETE FROM ${t.storageName!.replace('.', '."')}"`, values: [], labels: [], limit: 1 };
    await expect(store.run(del)).rejects.toThrow(/read-only/);
    const settings = await store.run({
      text: "SELECT current_setting('statement_timeout') AS f0, current_setting('transaction_read_only') AS f1",
      values: [],
      labels: ['timeout', 'readOnly'],
      limit: 1,
    });
    expect(settings.rows).toEqual([{ timeout: '30s', readOnly: 'on' }]);
    expect(await rowsOf(t)).toBeDefined(); // the failed statement did not poison the pool
  });

  it('loads a wide sheet in batches', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('Wide');
      ws.addRow(Array.from({ length: 300 }, (_, i) => `c${i}`));
      for (let r = 0; r < 450; r++) ws.addRow(Array.from({ length: 300 }, (_, i) => r + i));
    });
    const [wide] = await store.replaceAll(ds2, path);
    expect(wide.columns).toHaveLength(300);
    expect(wide.rowCount).toBe(450);
  });

  it('swaps tables on re-import and leaves other sources alone', async () => {
    const before = await store.tables(ds1);
    const other = await store.tables(ds2);
    const path = await build((wb) => wb.addWorksheet('New').addRow(['v']).worksheet.addRow([7]));
    const [fresh] = await store.replaceAll(ds1, path);
    const after = await store.tables(ds1);
    expect(after.map((t) => t.name)).toEqual(['New']);
    const names = await physical();
    for (const t of before) expect(names).not.toContain(t.storageName!.split('.')[1]);
    expect(names).toContain(fresh.storageName!.split('.')[1]);
    expect(await store.tables(ds2)).toEqual(other);
    expect(names).toContain(other[0].storageName!.split('.')[1]);
  });

  const direct = () => {
    const client = new Client({ connectionString: url });
    client.on('error', () => undefined);
    return client;
  };

  it('keeps the old data when a load fails part way', async () => {
    const before = await store.tables(ds1);
    const tablesBefore = await physical();
    const path = await build((wb) => {
      wb.addWorksheet('One').addRow(['a']).worksheet.addRow([1]);
      wb.addWorksheet('Two').addRow(['b']).worksheet.addRow([2]);
    });
    let calls = 0;
    await expect(
      runImport(direct(), ds1, path, {}, async (...args) => {
        if (++calls === 2) throw new Error('disk full');
        return loadSheet(...args);
      }),
    ).rejects.toThrow('disk full');
    expect(await store.tables(ds1)).toEqual(before);
    expect(await physical()).toEqual(tablesBefore); // the first new table was rolled back too
    expect((await rowsOf(before[0])).rows).toEqual([{ v: 7 }]);
  });

  it('rolls everything back when the connection dies mid-import, as it does when the worker is killed', async () => {
    const before = await store.tables(ds1);
    const tablesBefore = await physical();
    const path = await build((wb) => {
      wb.addWorksheet('One').addRow(['a']).worksheet.addRow([1]);
      wb.addWorksheet('Two').addRow(['b']).worksheet.addRow([2]);
    });
    const client = direct();
    let calls = 0;
    await expect(
      runImport(client, ds1, path, {}, async (c, ...rest) => {
        const t = await loadSheet(c, ...rest);
        if (++calls === 1) (c as unknown as { connection: { stream: { destroy(): void } } }).connection.stream.destroy();
        return t;
      }),
    ).rejects.toBeDefined();
    expect(await store.tables(ds1)).toEqual(before);
    expect(await physical()).toEqual(tablesBefore);
    const idle = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE state LIKE 'idle in transaction%' AND datname = current_database()");
    expect(idle.rows[0].n).toBe(0);
    const again = await build((wb) => wb.addWorksheet('Again').addRow(['v']).worksheet.addRow([7])); // the lock is free again
    expect((await store.replaceAll(ds1, again)).map((t) => t.name)).toEqual(['Again']);
  });

  it('refuses to commit when a sheet reads differently the second time', async () => {
    const before = await store.tables(ds1);
    const path = await build((wb) => wb.addWorksheet('One').addRow(['a']).worksheet.addRow([1]));
    await expect(
      runImport(direct(), ds1, path, {}, async (...args) => ({ ...(await loadSheet(...args)), rowCount: 99 })),
    ).rejects.toThrow('different number of rows');
    expect(await store.tables(ds1)).toEqual(before);
  });

  it('rejects plainly when the deadline kills the worker inside its transaction, keeps the old data, and the next import works', async () => {
    const before = await store.tables(ds1);
    const tablesBefore = await physical();
    // Holding the source's lock parks the worker right after its BEGIN, so the kill lands inside the transaction.
    const holder = direct();
    await holder.connect();
    await holder.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [ds1]);
    const parked = await build((wb) => wb.addWorksheet('Parked').addRow(['v']).worksheet.addRow([1]));
    try {
      await expect(store.replaceAll(ds1, parked, { deadlineMs: 6000 })).rejects.toMatchObject({
        constructor: BadRequestException,
        message: 'This file is too large to read',
      });
    } finally {
      await holder.query('SELECT pg_advisory_unlock_all()');
      await holder.end();
    }
    // The backend learns its client is gone when it next reads; once the lock is free it does, and rolls back.
    for (let i = 0; i < 40; i++) {
      const open = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND (state LIKE 'idle in transaction%' OR wait_event_type = 'Lock')");
      if (open.rows[0].n === 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(await store.tables(ds1)).toEqual(before);
    expect(await physical()).toEqual(tablesBefore);
    const next = await build((wb) => wb.addWorksheet('After').addRow(['v']).worksheet.addRow([1]));
    expect((await store.replaceAll(ds1, next)).map((t) => t.name)).toEqual(['After']);
  });

  it('rejects a file whose limits are lowered, plainly, and later imports still work', async () => {
    const wide = await build((wb) => wb.addWorksheet('Wide').addRow(['a', 'b', 'c']));
    await expect(store.replaceAll(ds1, wide, { limits: { columns: 2 } })).rejects.toThrow('more than 2 columns');
    const ok = await build((wb) => wb.addWorksheet('Fine').addRow(['v']).worksheet.addRow([1]));
    expect((await store.replaceAll(ds1, ok)).map((t) => t.name)).toEqual(['Fine']);
  });

  it('gives columns to data wider than the first row', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('Titled');
      ws.addRow(['Annual report']); // a title row, one cell wide
      ws.addRow(['a', 'b', 'c']);
      ws.addRow([1, 2, 3]);
    });
    const [t] = await store.replaceAll(ds1, path);
    expect(t.columns.map((c) => c.name)).toEqual(['Annual report', 'column_2', 'column_3']);
    expect(t.rowCount).toBe(2);
    const res = await rowsOf((await store.tables(ds1))[0]);
    expect(res.rows).toEqual([
      { 'Annual report': 'a', column_2: 'b', column_3: 'c' },
      { 'Annual report': '1', column_2: '2', column_3: '3' },
    ]);
  });

  it('serialises concurrent imports and removals of one source', async () => {
    const a = await build((wb) => {
      wb.addWorksheet('A1').addRow(['x']).worksheet.addRow([1]);
      wb.addWorksheet('A2').addRow(['x']).worksheet.addRow([1]);
    });
    const b = await build((wb) => {
      wb.addWorksheet('B1').addRow(['x']).worksheet.addRow([1]);
      wb.addWorksheet('B2').addRow(['x']).worksheet.addRow([1]);
    });
    const order: string[] = [];
    const tracked = (label: string, p: Promise<unknown>) => p.then(() => order.push(label));
    await Promise.all([
      tracked('a1', store.replaceAll(ds1, a)),
      tracked('b', store.replaceAll(ds1, b)),
      tracked('a2', store.replaceAll(ds1, a)),
      store.dropAll(ds1),
    ]);
    expect(order).toEqual(['a1', 'b', 'a2']); // one import at a time, in the order asked
    const names = (await store.tables(ds1)).map((t) => t.name);
    expect([[], ['A1', 'A2'], ['B1', 'B2']]).toContainEqual(names);
    const stored = (await store.tables(ds1)).concat(await store.tables(ds2)).map((t) => t.storageName!.split('.')[1]).sort();
    expect(await physical()).toEqual(stored); // no orphan tables
  });

  it('keeps the old data when the file is unreadable', async () => {
    const before = await store.tables(ds1);
    const bad = join(dir, 'bad.xlsx');
    await writeFile(bad, 'not a workbook');
    await expect(store.replaceAll(ds1, bad)).rejects.toThrow('Please upload an .xlsx file');
    expect(await store.tables(ds1)).toEqual(before);
  });

  it('drops everything for one source', async () => {
    await store.dropAll(ds1);
    expect(await store.tables(ds1)).toEqual([]);
    const names = await physical();
    const remaining = await store.tables(ds2);
    expect(names).toEqual(remaining.map((t) => t.storageName!.split('.')[1]).sort());
    await store.dropAll(ds2);
    expect(await physical()).toEqual([]);
  });
});
