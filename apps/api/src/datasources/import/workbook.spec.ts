/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { createDeflateRaw, crc32 } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ExcelJS from 'exceljs';
import { MAX_CELL_CHARS, extendHeader, readHeader, readWorkbook, sweepTempFolders, type Limits } from './workbook';

let dir: string;
const realTmp = process.env.TMPDIR;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'paarvix-import-'));
  // The importer makes its work folders in tmpdir(). Pointing it at a folder of our own keeps the
  // leftover checks from seeing folders of other tests or processes running at the same time.
  await mkdir(join(dir, 'tmp'));
  process.env.TMPDIR = join(dir, 'tmp');
});
afterAll(async () => {
  if (realTmp === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = realTmp;
  await rm(dir, { recursive: true, force: true });
});

let n = 0;
/** Builds a workbook with `fill` and returns its path. */
async function build(fill: (wb: ExcelJS.Workbook) => void): Promise<string> {
  const wb = new ExcelJS.Workbook();
  fill(wb);
  const path = join(dir, `book-${n++}.xlsx`);
  await wb.xlsx.writeFile(path);
  return path;
}

interface ZipEntry {
  name: string;
  /** Lies to put in the central directory. The local header, which real readers use, stays honest. */
  cd?: { method?: number; compressed?: number; name?: string; omit?: boolean };
  /** Pieces of the uncompressed content, produced lazily so a bomb never sits in memory. */
  chunks: () => Iterable<Buffer>;
}

/** Writes a small zip by hand, deflating each entry. Lets tests build hostile or corrupt files. */
async function zip(path: string, entries: ZipEntry[], eocdCount = entries.length): Promise<string> {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const packed: Buffer[] = [];
    const deflate = createDeflateRaw();
    deflate.on('data', (c: Buffer) => packed.push(c));
    const done = new Promise<void>((resolve) => deflate.on('end', resolve));
    let size = 0;
    let crc = 0;
    for (const c of e.chunks()) {
      size += c.length;
      crc = crc32(c, crc);
      if (!deflate.write(c)) await new Promise((r) => deflate.once('drain', r));
    }
    deflate.end();
    await done;
    const data = Buffer.concat(packed);
    const name = Buffer.from(e.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const lie = e.cd ?? {};
    const cdName = Buffer.from(lie.name ?? e.name);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(lie.method ?? 8, 10);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(lie.compressed ?? data.length, 20);
    head.writeUInt32LE(size, 24);
    head.writeUInt16LE(cdName.length, 28);
    head.writeUInt32LE(offset, 42);
    if (!lie.omit) central.push(head, cdName);
    parts.push(local, name, data);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(eocdCount, 8);
  end.writeUInt16LE(eocdCount, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(path, Buffer.concat([...parts, cd, end]));
  return path;
}

const text = (s: string) => () => [Buffer.from(s)];
/** Whitespace, which any XML parser accepts, so a bomb of it fails on our count and not on a parse error. */
const zeros = (megabytes: number) => () =>
  (function* () {
    const mb = Buffer.alloc(1024 * 1024, 0x20);
    for (let i = 0; i < megabytes; i++) yield mb;
  })();

const WORKBOOK =
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>';
const RELS =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';

/** The parts of the smallest workbook exceljs will read, with the given sheet XML. */
const baseEntries = (sheetXml: string): ZipEntry[] => [
  { name: 'xl/workbook.xml', chunks: text(WORKBOOK) },
  { name: 'xl/_rels/workbook.xml.rels', chunks: text(RELS) },
  { name: 'xl/worksheets/sheet1.xml', chunks: text(sheetXml) },
];
const miniXlsx = (name: string, sheetXml: string, extra: ZipEntry[] = []) => zip(join(dir, name), [...baseEntries(sheetXml), ...extra]);
const inline = (ref: string, v: string) => `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
const sheetWith = (rows: string) => `<worksheet><sheetData>${rows}</sheetData></worksheet>`;

const ours = async () => (await readdir(tmpdir())).filter((f) => f.startsWith('paarvix-xlsx-') && !f.startsWith('paarvix-xlsx-job-'));

/** Reads every sheet fully: name, header and data rows. */
async function load(path: string, limits?: Partial<Limits>) {
  const out: { name: string; header: string[]; rows: unknown[][] }[] = [];
  for await (const sheet of readWorkbook(path, limits)) {
    const header = await readHeader(sheet.rows);
    const rows: unknown[][] = [];
    for await (const r of sheet.rows) rows.push(r);
    out.push({ name: sheet.name, header, rows });
  }
  return out;
}

describe('readWorkbook', () => {
  it('skips blank rows above the data and takes the first non-empty row as header', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('Marks');
      ws.getCell('A3').value = 'Name';
      ws.getCell('B3').value = 'Score';
      ws.addRow(['Asha', 90]);
      ws.addRow([]);
      ws.addRow(['Ravi', 80]);
    });
    const [sheet] = await load(path);
    expect(sheet.header).toEqual(['Name', 'Score']);
    expect(sheet.rows).toEqual([['Asha', 90], ['Ravi', 80]]);
  });

  it('keeps columns aligned under a merged header', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('Merged');
      ws.addRow(['Group', null, 'Score']);
      ws.mergeCells('A1:B1');
      ws.addRow(['x', 'y', 5]);
    });
    const [sheet] = await load(path);
    expect(sheet.header).toEqual(['Group', 'column_2', 'Score']);
    expect(sheet.rows).toEqual([['x', 'y', 5]]);
  });

  it('names blank and duplicate headers', async () => {
    const path = await build((wb) => {
      wb.addWorksheet('Dup').addRow(['Name', '', 'Name', 'Name', 'Name_2']);
    });
    const [sheet] = await load(path);
    expect(sheet.header).toEqual(['Name', 'column_2', 'Name_2', 'Name_3', 'Name_2_2']);
  });

  it('yields the stored result of a formula in streaming mode', async () => {
    const path = await build((wb) => {
      const ws = wb.addWorksheet('F');
      ws.addRow(['a', 'b', 'total', 'label']);
      const r = ws.addRow([3, 4]);
      r.getCell(3).value = { formula: 'A2+B2', result: 7 };
      r.getCell(4).value = { formula: 'CONCATENATE("x","y")', result: 'xy' };
    });
    const [sheet] = await load(path);
    expect(sheet.rows).toEqual([[3, 4, 7, 'xy']]);
  });

  it('reads dates, booleans, rich text and Tamil and long sheet names', async () => {
    const tamil = 'மதிப்பெண் பட்டியல் ஆண்டு 2026';
    const path = await build((wb) => {
      const ws = wb.addWorksheet(tamil);
      ws.addRow(['d', 'b', 'r']);
      ws.addRow([new Date(Date.UTC(2026, 7, 15)), true, { richText: [{ text: 'a' }, { text: 'b' }] }]);
    });
    const [sheet] = await load(path);
    expect(sheet.name).toBe(tamil);
    expect(sheet.rows[0][0]).toEqual(new Date(Date.UTC(2026, 7, 15)));
    expect(sheet.rows[0].slice(1)).toEqual([true, 'ab']);
  });

  it('skips an empty sheet and gives a header-only sheet no rows', async () => {
    const path = await build((wb) => {
      wb.addWorksheet('Empty');
      wb.addWorksheet('Head').addRow(['a', 'b']);
      wb.addWorksheet('Data').addRow(['a']).worksheet.addRow([1]);
    });
    const sheets = await load(path);
    expect(sheets.map((s) => [s.name, s.rows.length])).toEqual([['Head', 0], ['Data', 1]]);
  });

  it('works when the caller skips the rows of a sheet', async () => {
    const path = await build((wb) => {
      wb.addWorksheet('One').addRow(['a']).worksheet.addRow([1]);
      wb.addWorksheet('Two').addRow(['b']).worksheet.addRow([2]);
    });
    const names: string[] = [];
    for await (const s of readWorkbook(path)) names.push(s.name);
    expect(names).toEqual(['One', 'Two']);
  });

  it('never drops sheets from a small workbook with many sheets', async () => {
    const path = await build((wb) => {
      for (let i = 0; i < 12; i++) wb.addWorksheet(`S${i}`).addRow(['a']).worksheet.addRow([i]);
    });
    for (let run = 0; run < 15; run++) {
      const sheets = await load(path);
      expect(sheets.map((s) => s.name)).toEqual(Array.from({ length: 12 }, (_, i) => `S${i}`));
    }
  });

  it('rejects a file with no data', async () => {
    const path = await build((wb) => wb.addWorksheet('Empty'));
    await expect(load(path)).rejects.toThrow('This file has no data');
  });

  it('rejects a file that is not an xlsx', async () => {
    const path = join(dir, 'renamed.xlsx');
    await writeFile(path, 'just some text, not a workbook');
    await expect(load(path)).rejects.toThrow('Please upload an .xlsx file');
  });

  it('rejects more than 500 columns and more than 50 sheets', async () => {
    const wide = await build((wb) => wb.addWorksheet('Wide').addRow(Array.from({ length: 501 }, (_, i) => `c${i}`)));
    await expect(load(wide)).rejects.toThrow('more than 500 columns');
    const many = await build((wb) => {
      for (let i = 0; i < 51; i++) wb.addWorksheet(`S${i}`).addRow(['a']);
    });
    await expect(load(many)).rejects.toThrow('more than 50 sheets');
  });

  describe('hostile files', () => {
    const TOO_LARGE = 'This file is too large to read';
    const tiny: Partial<Limits> = { sharedStringBytes: 512 * 1024, xmlPartBytes: 512 * 1024, totalBytes: 4 * 1024 * 1024 };
    const row = `<row r="1">${inline('A1', 'h')}</row>`;

    /** Rejects with a plain BadRequest and leaves no temp folder behind. */
    async function refuses(path: string, message: string, limits: Partial<Limits> = tiny) {
      const before = await ours();
      const err = await load(path, limits).then(
        () => undefined,
        (e: Error) => e,
      );
      expect(err?.constructor.name).toBe('BadRequestException');
      expect(err?.message).toBe(message);
      expect(await ours()).toEqual(before);
    }

    it.each([
      ['xl/sharedStrings.xml'],
      ['xl/styles.xml'],
      ['xl/_rels/workbook.xml.rels'],
      ['xl/worksheets/_rels/sheet1.xml.rels'],
    ])('refuses an honest archive whose %s inflates past its cap', async (part) => {
      const entries = baseEntries(sheetWith(row)).filter((e) => e.name !== part);
      const path = await zip(join(dir, 'bomb-honest.xlsx'), [...entries, { name: part, chunks: zeros(1) }]);
      await refuses(path, TOO_LARGE);
    });

    it('refuses a workbook.xml that inflates past its cap', async () => {
      const entries = baseEntries(sheetWith(row)).filter((e) => e.name !== 'xl/workbook.xml');
      const path = await zip(join(dir, 'bomb-wb.xlsx'), [{ name: 'xl/workbook.xml', chunks: zeros(1) }, ...entries]);
      await refuses(path, TOO_LARGE);
    });

    // The central directory is advice; readers use the local headers, so a file can lie in it.
    it.each([
      ['method set to stored', { method: 0 }, undefined],
      ['compressed size 0', { compressed: 0 }, undefined],
      ['entry left out', { omit: true }, undefined],
      ['name changed to a directory', { name: 'x/' }, undefined],
      ['entry count 0', {}, 0],
    ])('refuses a shared-strings bomb when the central directory lies: %s', async (_label, cd, count) => {
      const path = await zip(
        join(dir, 'bomb-lie.xlsx'),
        [...baseEntries(sheetWith(row)), { name: 'xl/sharedStrings.xml', chunks: zeros(1), cd }],
        count,
      );
      await refuses(path, TOO_LARGE);
    });

    it('refuses a total over the byte cap, and bounds temp writes for sheets read before workbook.xml', async () => {
      const path = await zip(join(dir, 'bomb-total.xlsx'), [
        { name: 'xl/worksheets/sheet1.xml', chunks: zeros(6), cd: { compressed: 0 } },
        ...baseEntries(sheetWith(row)).slice(0, 2),
      ]);
      await refuses(path, TOO_LARGE);
    });

    it('refuses more entries than allowed and more than 50 sheet entries before extracting them', async () => {
      const many = await zip(join(dir, 'many.xlsx'), Array.from({ length: 12 }, (_, i) => ({ name: `f${i}.txt`, chunks: text('x') })));
      await refuses(many, TOO_LARGE, { entries: 10 });
      const sheets = await zip(
        join(dir, 'sheets.xlsx'),
        Array.from({ length: 4 }, (_, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, chunks: text(sheetWith(row)) })),
      );
      await refuses(sheets, 'This file has more than 3 sheets', { sheets: 3 });
    });

    const GENERIC = 'This file could not be read. Please check it is a valid .xlsx file';
    const STYLES = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>';
    /** Breaks the deflate data of one entry: 0xFF as the first byte is a reserved block type. */
    async function corrupt(path: string, entry: string): Promise<string> {
      const buf = await readFile(path);
      buf[buf.indexOf(Buffer.from(entry)) + Buffer.byteLength(entry)] = 0xff;
      await writeFile(path, buf);
      return path;
    }

    it.each([['xl/styles.xml'], ['xl/workbook.xml'], ['xl/worksheets/sheet1.xml']])(
      'fails fast on a corrupt deflate stream in %s instead of hanging',
      async (part) => {
        const entries = [...baseEntries(sheetWith(row)), { name: 'xl/styles.xml', chunks: text(STYLES) }];
        const path = await corrupt(await zip(join(dir, 'corrupt-part.xlsx'), entries), part);
        await refuses(path, GENERIC, {});
      },
    );

    it.each([['xl/workbook.xml'], ['xl/worksheets/sheet1.xml']])('fails fast on an archive truncated inside %s', async (part) => {
      const many = Array.from({ length: 5000 }, (_, i) => `<row r="${i + 1}">${inline(`A${i + 1}`, `value ${i} ${Math.sin(i)}`)}</row>`).join('');
      const full = await zip(join(dir, 'whole.xlsx'), [...baseEntries(sheetWith(many)), { name: 'xl/styles.xml', chunks: text(STYLES) }]);
      const buf = await readFile(full);
      const cut = join(dir, 'truncated.xlsx');
      await writeFile(cut, buf.subarray(0, buf.indexOf(Buffer.from(part)) + part.length + 40));
      await refuses(cut, GENERIC, {});
    });

    const fds = () => readdirSync('/proc/self/fd').length;
    (process.platform === 'linux' ? it : it.skip)('closes every temp file descriptor when it rejects a file read before workbook.xml', async () => {
      const path = await zip(join(dir, 'fd.xlsx'), [
        { name: 'xl/worksheets/sheet1.xml', chunks: zeros(3) },
        ...baseEntries(sheetWith(row)).slice(0, 2),
      ]);
      await load(path, { totalBytes: 512 * 1024 }).catch(() => undefined); // warm up lazy handles
      const before = fds();
      for (let i = 0; i < 6; i++) {
        await expect(load(path, { totalBytes: 512 * 1024 })).rejects.toThrow(TOO_LARGE);
      }
      expect(fds() - before).toBeLessThanOrEqual(1);
    });

    it('keeps Tamil text intact when a chunk boundary falls inside a character', async () => {
      const bad = (v: unknown) => typeof v === 'string' && v.includes('\uFFFD');
      // Shared strings (what Excel and exceljs write) and inline strings (what streaming writers write).
      const shared = await build((wb) => {
        const ws = wb.addWorksheet('Tamil');
        ws.addRow(['பெயர்', 'மதிப்பெண்']);
        for (let i = 0; i < 6000; i++) ws.addRow([`தமிழ் மாணவர் ${i}`, `சிறப்பு தேர்ச்சி ${i}`]);
      });
      const [a] = await load(shared);
      expect(a.rows).toHaveLength(6000);
      expect(a.rows.flat().filter(bad)).toHaveLength(0);
      expect(a.rows[5999]).toEqual(['தமிழ் மாணவர் 5999', 'சிறப்பு தேர்ச்சி 5999']);

      const many = Array.from({ length: 6000 }, (_, i) => `<row r="${i + 2}">${inline(`A${i + 2}`, `தமிழ் மாணவர் ${i}`)}</row>`).join('');
      const [b] = await load(await miniXlsx('tamil-inline.xlsx', sheetWith(`<row r="1">${inline('A1', 'பெயர்')}</row>${many}`)));
      expect(b.rows).toHaveLength(6000);
      expect(b.rows.flat().filter(bad)).toHaveLength(0);
      expect(b.rows[5999][0]).toBe('தமிழ் மாணவர் 5999');
    });

    it('finds sheet names when relationship targets are absolute, as openpyxl writes them', async () => {
      const entries = baseEntries(sheetWith(row)).map((e) =>
        e.name === 'xl/_rels/workbook.xml.rels' ? { ...e, chunks: text(RELS.replace('Target="worksheets/', 'Target="/xl/worksheets/')) } : e,
      );
      const [sheet] = await load(await zip(join(dir, 'absolute-rels.xlsx'), entries));
      expect(sheet.name).toBe('S');
    });

    it('reads a large honest workbook under the default caps', async () => {
      const path = await build((wb) => {
        const ws = wb.addWorksheet('Large');
        ws.addRow(['id', 'name', 'amount']);
        for (let i = 0; i < 30000; i++) ws.addRow([i, `name ${i}`, i * 1.5]);
      });
      const [sheet] = await load(path);
      expect(sheet.rows).toHaveLength(30000);
    });

    it('sweeps old work folders left by a killed process and keeps recent ones', async () => {
      const old = join(tmpdir(), `paarvix-xlsx-sweep-old-${process.pid}`);
      const fresh = join(tmpdir(), `paarvix-xlsx-sweep-new-${process.pid}`);
      await mkdir(old);
      await mkdir(fresh);
      const longAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await utimes(old, longAgo, longAgo);
      await sweepTempFolders();
      const left = await ours();
      expect(left).not.toContain(`paarvix-xlsx-sweep-old-${process.pid}`);
      expect(left).toContain(`paarvix-xlsx-sweep-new-${process.pid}`);
      await rm(fresh, { recursive: true, force: true });
    });

    it('removes its temp files when a limit rejects the file', async () => {
      const before = await ours();
      const wide = await build((wb) => wb.addWorksheet('Wide').addRow(Array.from({ length: 501 }, (_, i) => `c${i}`)));
      await expect(load(wide)).rejects.toThrow('more than 500 columns');
      const corrupt = await miniXlsx('leak.xlsx', sheetWith(`<row r="1">${inline('A1', 'h')}</row><row r="2"></c></row>`));
      await expect(load(corrupt)).rejects.toThrow();
      expect(await ours()).toEqual(before);
    });

    it('counts blank rows toward the row limit', async () => {
      const path = await build((wb) => {
        const ws = wb.addWorksheet('Blanks');
        ws.addRow(['h']);
        for (let r = 2; r <= 8; r++) ws.getCell(`A${r}`).value = ' ';
      });
      await expect(load(path, { rows: 3 })).rejects.toThrow('has more than 3 rows');
    });

    it('never shows parser text from a corrupt sheet, even when it fails after the first rows', async () => {
      const many = Array.from({ length: 20000 }, (_, i) => `<row r="${i + 1}">${inline(`A${i + 1}`, 'value')}</row>`).join('');
      const path = await miniXlsx('corrupt.xlsx', sheetWith(`${many}<row r="20001"></c></row>`));
      const err = await load(path).then(
        () => undefined,
        (e: Error) => e,
      );
      expect(err?.message).toBe('This file could not be read. Please check it is a valid .xlsx file');
    });
  });

  describe('cell values', () => {
    it('turns a date formula into a date', async () => {
      const path = await build((wb) => {
        const ws = wb.addWorksheet('D');
        ws.addRow(['when']);
        const c = ws.getCell('A2');
        c.value = { formula: 'A1+30', result: 46000 };
        c.numFmt = 'yyyy-mm-dd';
        ws.getCell('B2').value = { formula: 'A1+30', result: 46000 }; // not a date format: stays a number
      });
      const [sheet] = await load(path);
      expect(sheet.rows[0][0]).toEqual(new Date(Date.UTC(2025, 11, 9)));
      expect(sheet.rows[0][1]).toBe(46000);
    });

    it('drops a date no database can hold', async () => {
      const path = await build((wb) => {
        const ws = wb.addWorksheet('D');
        ws.addRow(['when', 'n']);
        ws.addRow([new Date(Date.UTC(12000, 0, 1)), 5]);
      });
      const [sheet] = await load(path);
      expect(sheet.rows).toEqual([[null, 5]]);
    });

    it('cuts a cell at Excel limit and a header name at 255 characters', async () => {
      const path = await build((wb) => {
        const ws = wb.addWorksheet('Long');
        ws.addRow(['h'.repeat(400)]);
        ws.addRow(['x'.repeat(MAX_CELL_CHARS + 500)]);
      });
      const [sheet] = await load(path);
      expect(sheet.header[0]).toHaveLength(255);
      expect((sheet.rows[0][0] as string).length).toBe(MAX_CELL_CHARS);
    });

    it('writes a date header as date text', async () => {
      const path = await build((wb) => wb.addWorksheet('H').addRow([new Date(Date.UTC(2026, 3, 1)), 'b']));
      const [sheet] = await load(path);
      expect(sheet.header).toEqual(['2026-04-01', 'b']);
    });
  });

  it('extends a header to the width of the data', () => {
    expect(extendHeader(['Title'], 3)).toEqual(['Title', 'column_2', 'column_3']);
    expect(extendHeader(['column_2'], 2)).toEqual(['column_2', 'column_2_2']);
    expect(extendHeader(['a', 'b'], 1)).toEqual(['a', 'b']);
  });
});
