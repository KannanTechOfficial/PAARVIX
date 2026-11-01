/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, open, readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as ExcelJS from 'exceljs';
import { validDate } from './infer';

/**
 * Defaults. `readWorkbook` takes overrides, so tests can use tiny values. These only bound bytes; what a hostile
 * file can do with the objects it builds is bounded by running the whole import in a worker with a heap limit.
 */
export const LIMITS = {
  sheets: 50,
  columns: 500,
  rows: 1_000_000,
  /** Real inflated bytes of all entries, counted as they are read. Sizes a file declares about itself are never used. */
  totalBytes: 1024 ** 3,
  sharedStringBytes: 128 * 1024 ** 2,
  /** xl/styles.xml, xl/workbook.xml and every .rels part: real ones are a few hundred KB at most. */
  xmlPartBytes: 16 * 1024 ** 2,
  entries: 5000,
};
export type Limits = typeof LIMITS;
export const MAX_CELL_CHARS = 32_767; // Excel's own limit
export const MAX_NAME_CHARS = 255;

export interface SheetRows {
  name: string;
  /** Non-empty rows, header row first. Single use: read it once, in order. */
  rows: AsyncIterable<unknown[]>;
}

const tooLarge = () => new BadRequestException('This file is too large to read');
const unreadable = () => new BadRequestException('This file could not be read. Please check it is a valid .xlsx file');
const asBadRequest = (e: unknown) => (e instanceof BadRequestException ? e : unreadable());

/** A .xlsx is a ZIP archive. Macros, if any, are never read. */
async function assertXlsx(path: string): Promise<void> {
  const file = await open(path, 'r');
  try {
    const head = Buffer.alloc(4);
    const { bytesRead } = await file.read(head, 0, 4, 0);
    if (bytesRead < 4 || !head.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new BadRequestException('Please upload an .xlsx file');
    }
  } finally {
    await file.close();
  }
}

// exceljs 4.4.0 internals the streaming reader below depends on. The version is pinned in package.json.
const REQUIRED_METHODS = ['_getStream', '_parseRels', '_parseWorkbook', '_parseSharedStrings', '_parseStyles', '_parseWorksheet'];
/** The spreadsheet reader library is not the version this code wraps. Its message names no file content. */
export class UnsupportedReaderError extends Error {}

let internalsCache: { unzip: any; iterateStream: any; utils: any } | undefined;

function internals() {
  if (internalsCache) return internalsCache;
  const proto = ExcelJS.stream.xlsx.WorkbookReader.prototype as any;
  try {
    const load = createRequire(require.resolve('exceljs'));
    const found = { unzip: load('unzipper'), iterateStream: load('./lib/utils/iterate-stream'), utils: load('./lib/utils/utils') };
    const missing = REQUIRED_METHODS.filter((m) => typeof proto[m] !== 'function');
    if (missing.length || typeof found.utils.isDateFmt !== 'function' || typeof found.utils.excelToDate !== 'function') {
      throw new Error(`missing ${missing.join(', ') || 'utils'}`);
    }
    return (internalsCache = found);
  } catch (e) {
    throw new UnsupportedReaderError(`The installed exceljs is not the version Paarvix was built for (4.4.0): ${(e as Error).message}`);
  }
}

/**
 * Sits on every zip entry as the bytes come out of the inflater and counts them, per entry and in total.
 * It uses the entry name from the local header the parser really reads, never the zip's own directory.
 */
class Guard extends Transform {
  private n = 0;

  constructor(
    private readonly budget: { total: number },
    private readonly cap: number,
    private readonly lim: Limits,
    private readonly onFail: (e: Error) => void,
  ) {
    super();
  }

  _transform(chunk: Buffer, _enc: string, cb: (e?: Error | null, d?: Buffer) => void) {
    this.n += chunk.length;
    this.budget.total += chunk.length;
    if (this.n > this.cap || this.budget.total > this.lim.totalBytes) {
      const e = tooLarge();
      this.onFail(e);
      return cb(e);
    }
    cb(null, chunk);
  }
}

/**
 * Two bugs in exceljs 4.4.0's streaming reader, both crashing or silently losing data on valid files:
 * 1. It reads sheets straight away once it has the relationships file, but needs workbook.xml for sheet
 *    names, and some writers (exceljs itself) put workbook.xml last. Here the relationships stay hidden
 *    until workbook.xml is read, so sheets that come first are parsed afterwards.
 * 2. Its zip parser announces the end of the archive as soon as the whole file has been fed in, while
 *    entries are still queued, so small files lose their last sheets. Here that early 'end' is dropped
 *    and only the real end, after the last entry, counts.
 * `parse` is its own loop (the original leaks its temp files when a limit rejects the file): sheets that
 * must wait go in a folder of their own that is always removed.
 */
class SafeReader extends ExcelJS.stream.xlsx.WorkbookReader {
  private held: unknown;

  async _parseRels(entry: unknown): Promise<void> {
    const proto = ExcelJS.stream.xlsx.WorkbookReader.prototype as any;
    await proto._parseRels.call(this, entry);
    // Some writers (openpyxl) use absolute targets like /xl/worksheets/sheet1.xml, which exceljs does not match.
    for (const rel of (this as any).workbookRels ?? []) {
      if (typeof rel.Target === 'string') rel.Target = rel.Target.replace(/^\/?xl\//, '').replace(/^\//, '');
    }
    if (!(this as any).model) {
      this.held = (this as any).workbookRels;
      (this as any).workbookRels = undefined;
    }
  }

  async _parseWorkbook(entry: unknown): Promise<void> {
    const proto = ExcelJS.stream.xlsx.WorkbookReader.prototype as any;
    await proto._parseWorkbook.call(this, entry);
    if (this.held) (this as any).workbookRels = this.held;
  }

  limits: Limits = LIMITS;
  workRoot: string = tmpdir();

  async *parse(): AsyncGenerator<unknown> {
    const { unzip, iterateStream } = internals();
    const self = this as any;
    const lim = this.limits;
    const dir = await mkdtemp(join(this.workRoot, 'paarvix-xlsx-'));
    const budget = { total: 0 };
    let aborted: Error | undefined;
    let input: Readable | undefined;
    let zip: Readable | undefined;
    let current: Readable | undefined;
    let counted: Readable | undefined;
    let sheetFile: Readable | undefined;
    // Stops everything at once, whichever part of the pipeline noticed the problem. Failing `counted` is what
    // wakes whoever is reading it; without that a corrupt stream would leave the reader waiting forever.
    const abort = (e: Error) => {
      if (aborted) return;
      aborted = e;
      counted?.destroy(e);
      current?.destroy();
      zip?.destroy(e); // wakes the loop if it is waiting for the next entry
      input?.destroy();
    };
    try {
      input = self.stream = self._getStream(self.input) as Readable;
      zip = unzip.Parse({ forceStream: true }) as Readable;
      zip.on('error', abort); // corrupt or truncated archive
      const emit = zip.emit;
      let inFinish = false;
      (zip as any).emit = function (event: string, ...args: unknown[]) {
        if (event === 'finish') {
          inFinish = true;
          try {
            return emit.call(this, event, ...args);
          } finally {
            inFinish = false;
          }
        }
        if (inFinish && (event === 'end' || event === 'close')) return false;
        return emit.call(this, event, ...args);
      };
      input.pipe(zip as any);

      const waiting: { sheetNo: string; path: string }[] = [];
      let entries = 0;
      let sheetEntries = 0;
      for await (const entry of iterateStream(zip)) {
        current = entry;
        const name: string = entry.path;
        if (++entries > lim.entries) throw tooLarge();
        const sheet = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(name);
        if (sheet && ++sheetEntries > lim.sheets) throw new BadRequestException(`This file has more than ${lim.sheets} sheets`);
        const read = !!sheet || name === 'xl/workbook.xml' || name === 'xl/_rels/workbook.xml.rels' || name === 'xl/sharedStrings.xml' || name === 'xl/styles.xml';
        const cap = name === 'xl/sharedStrings.xml' ? lim.sharedStringBytes : /^xl\/(styles|workbook)\.xml$|\.rels$/.test(name) ? lim.xmlPartBytes : Infinity;
        counted = entry.pipe(new Guard(budget, cap, lim, abort)) as Readable;
        counted.on('error', abort);
        // The parser decodes each chunk on its own, so a multi-byte character cut by a chunk boundary would
        // turn into U+FFFD. setEncoding keeps the partial bytes until the rest arrives.
        if (read) counted.setEncoding('utf8');

        if (name === 'xl/_rels/workbook.xml.rels') await self._parseRels(counted);
        else if (name === 'xl/workbook.xml') await self._parseWorkbook(counted);
        else if (name === 'xl/sharedStrings.xml') yield* self._parseSharedStrings(counted);
        else if (name === 'xl/styles.xml') await self._parseStyles(counted);
        else if (sheet && self.sharedStrings && self.workbookRels) yield* self._parseWorksheet(iterateStream(counted), sheet[1]);
        else if (sheet) {
          const path = join(dir, `sheet${sheet[1]}.xml`);
          // pipeline closes the file on any failure, so a rejected file leaks no descriptor
          await pipeline(counted, createWriteStream(path));
          waiting.push({ sheetNo: sheet[1], path });
        }
        counted.resume(); // inflated bytes of anything not read still pass the guard
        if (aborted) throw aborted;
      }

      for (const { sheetNo, path } of waiting) {
        sheetFile = createReadStream(path, { encoding: 'utf8' });
        yield* self._parseWorksheet(sheetFile, sheetNo);
        sheetFile.destroy();
        sheetFile = undefined;
        await rm(path, { force: true });
      }
    } catch (e) {
      throw aborted ?? e;
    } finally {
      sheetFile?.destroy();
      counted?.destroy();
      current?.destroy();
      zip?.destroy();
      input?.destroy();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/**
 * Reduces whatever exceljs returns for a cell (formula, rich text, link, error) to a plain value.
 * A formula that returns TRUE or FALSE arrives as 1 or 0: streaming exceljs reads every non-text formula
 * result with parseFloat and does not keep the cell's type, so the boolean cannot be told from the number.
 */
function plain(v: unknown, format?: string, date1904?: boolean): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.length > MAX_CELL_CHARS ? v.slice(0, MAX_CELL_CHARS) : v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null; // a failed formula result parses as NaN
  if (v instanceof Date) return validDate(v) ? v : null;
  if (typeof v !== 'object') return typeof v === 'boolean' ? v : null;
  const o = v as Record<string, unknown>;
  if ('result' in o) {
    const { utils } = internals();
    // Streaming exceljs does not convert date formulas, so =A2+30 would arrive as a serial number.
    if (typeof o.result === 'number' && format && utils.isDateFmt(format)) return plain(utils.excelToDate(o.result, date1904));
    return plain(o.result);
  }
  if (Array.isArray(o.richText)) return plain(o.richText.map((p: { text?: string }) => p.text ?? '').join(''));
  if ('text' in o) return plain(o.text); // hyperlink
  return null; // error value, or a shared string we could not resolve
}

const isEmpty = (v: unknown) => v === null || (typeof v === 'string' && v.trim() === '');

/** Non-empty rows of one sheet as arrays indexed by column, so a merged or skipped cell never shifts later columns. */
async function* sheetRows(ws: AsyncIterable<ExcelJS.Row>, name: string, reader: any, lim: Limits): AsyncGenerator<unknown[]> {
  let count = 0;
  for await (const row of ws) {
    if (++count > lim.rows + 1) {
      throw new BadRequestException(`Sheet "${name.slice(0, 64)}" has more than ${lim.rows.toLocaleString('en-US')} rows`);
    }
    const date1904 = !!reader.properties?.model?.date1904;
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col > lim.columns) throw new BadRequestException(`Sheet "${name.slice(0, 64)}" has more than ${lim.columns} columns`);
      cells[col - 1] = plain(cell.value, cell.numFmt, date1904);
    });
    const values = Array.from(cells, (v) => v ?? null);
    if (!values.every(isEmpty)) yield values;
  }
}

/**
 * Streams each non-empty sheet of an .xlsx. Rows are never held in memory.
 * Read the rows of a sheet in order; unread rows are skipped when you move to the next sheet.
 */
export async function* readWorkbook(path: string, overrides: Partial<Limits> = {}, workRoot: string = tmpdir()): AsyncGenerator<SheetRows> {
  const lim: Limits = { ...LIMITS, ...overrides };
  await assertXlsx(path);
  internals();
  const reader = new SafeReader(path, {
    worksheets: 'emit',
    sharedStrings: 'cache', // string cells are lookups into this table
    styles: 'cache', // needed to tell date cells from numbers
    hyperlinks: 'ignore',
    entries: 'ignore',
  });
  reader.limits = lim;
  reader.workRoot = workRoot;
  let sheets = 0;
  let found = 0;
  try {
    for await (const ws of reader) {
      if (++sheets > lim.sheets) throw new BadRequestException(`This file has more than ${lim.sheets} sheets`);
      const name = (ws as unknown as { name: string }).name;
      if (name.length > MAX_NAME_CHARS) throw new BadRequestException('A sheet name is too long');
      const rows = sheetRows(ws as unknown as AsyncIterable<ExcelJS.Row>, name, reader, lim);
      const first = await rows.next();
      if (first.done) continue;
      found++;
      yield {
        name,
        rows: (async function* () {
          try {
            yield first.value;
            yield* rows;
          } catch (e) {
            throw asBadRequest(e); // parser errors can quote the file's content
          }
        })(),
      };
      for await (const _skipped of rows); // finish the sheet so the archive can advance
    }
  } catch (e) {
    throw asBadRequest(e);
  }
  if (!found) throw new BadRequestException('This file has no data');
}

function headerName(cell: unknown, i: number): string {
  if (isEmpty(cell)) return `column_${i + 1}`;
  const text = cell instanceof Date ? cell.toISOString().replace(/T00:00:00\.000Z$/, '') : String(cell).trim();
  return text.slice(0, MAX_NAME_CHARS);
}

function unique(base: string, used: Set<string>): string {
  let name = base;
  for (let k = 2; used.has(name); k++) name = `${base}_${k}`;
  used.add(name);
  return name;
}

/** Adds column_N names so every column of the data has a header, e.g. when a title row came first. */
export function extendHeader(header: string[], width: number): string[] {
  const used = new Set(header);
  const out = [...header];
  for (let i = header.length; i < width; i++) out.push(unique(`column_${i + 1}`, used));
  return out;
}

/** Takes the first row of `rows` as column names: blank ones become column_N, repeats get _2, _3. */
export async function readHeader(rows: AsyncIterable<unknown[]>): Promise<string[]> {
  const first = await rows[Symbol.asyncIterator]().next();
  const raw = first.done ? [] : first.value;
  const used = new Set<string>();
  return raw.map((cell, i) => unique(headerName(cell, i), used));
}

/** Removes work folders a killed process left behind. Only old ones, so a running import in another process is safe. */
export async function sweepTempFolders(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  const base = tmpdir();
  for (const f of await readdir(base)) {
    if (!f.startsWith('paarvix-xlsx-') || f.startsWith('paarvix-xlsx-job-')) continue;
    const path = join(base, f);
    const info = await stat(path).catch(() => undefined);
    if (info?.isDirectory() && Date.now() - info.mtimeMs > maxAgeMs) await rm(path, { recursive: true, force: true });
  }
}
