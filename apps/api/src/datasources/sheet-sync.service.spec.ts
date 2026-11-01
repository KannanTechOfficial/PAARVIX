/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { SheetSyncService } from './sheet-sync.service';

jest.mock('./connectors/gsheet.client', () => ({ downloadSheet: jest.fn() }));
import { downloadSheet } from './connectors/gsheet.client';

const row = { id: 's1', type: 'gsheet', config: { spreadsheetId: 'abcdefghij' } };
function make() {
  let stored: any = { ...row };
  const prisma = {
    datasource: {
      findUnique: jest.fn(async () => stored),
      updateMany: jest.fn(async ({ data }) => ((stored = { ...stored, ...data }), { count: 1 })),
    },
  };
  const store = { replaceAll: jest.fn() };
  return { prisma, store, service: new SheetSyncService(prisma as any, store as any), get: () => stored };
}

describe('SheetSyncService', () => {
  beforeEach(() => jest.mocked(downloadSheet).mockReset());

  it('records lastSyncAt on success', async () => {
    const t = make();
    await t.service.sync('s1');
    expect(t.get().config.lastSyncAt).toBeDefined();
    expect(t.get().config.lastSyncError).toBeUndefined();
  });

  it('records a plain error, keeps old data, and releases the lock', async () => {
    const t = make();
    t.store.replaceAll.mockRejectedValueOnce(new Error('cell value Alice 1234'));
    await expect(t.service.sync('s1')).rejects.toThrow('Could not read this sheet');
    expect(t.get().config.lastSyncError).toBe('Could not read this sheet');
    await t.service.sync('s1'); // not stuck on "already running"
    expect(t.get().config.lastSyncError).toBeUndefined();
  });

  it('refuses a second sync of the same source while one runs', async () => {
    const t = make();
    let release!: () => void;
    jest.mocked(downloadSheet).mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const first = t.service.sync('s1');
    while (!release) await new Promise((r) => setImmediate(r)); // wait until the download has started
    await expect(t.service.sync('s1')).rejects.toThrow('Sync already running');
    release();
    await first;
  });

  it('reports a running sync and a source removed mid-sync does not break it', async () => {
    const t = make();
    let release!: () => void;
    jest.mocked(downloadSheet).mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const run = t.service.sync('s1');
    while (!release) await new Promise((r) => setImmediate(r));
    expect(t.service.isRunning('s1')).toBe(true);
    t.prisma.datasource.updateMany.mockResolvedValue({ count: 0 } as never); // row gone
    release();
    await run;
    expect(t.service.isRunning('s1')).toBe(false);
  });

  it('isDue honours the interval, failed attempts, and a missing interval', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    const ago = (m: number) => new Date(now - m * 60_000).toISOString();
    expect(SheetSyncService.isDue({}, now)).toBe(false);
    expect(SheetSyncService.isDue({ syncMinutes: 10 }, now)).toBe(false);
    expect(SheetSyncService.isDue({ syncMinutes: 15 }, now)).toBe(true);
    expect(SheetSyncService.isDue({ syncMinutes: 15, lastSyncAt: ago(20) }, now)).toBe(true);
    expect(SheetSyncService.isDue({ syncMinutes: 15, lastSyncAt: ago(20), lastAttemptAt: ago(1) }, now)).toBe(false);
  });
});
