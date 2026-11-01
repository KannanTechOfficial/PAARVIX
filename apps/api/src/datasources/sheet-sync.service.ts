/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { downloadSheet } from './connectors/gsheet.client';
import { TableStore } from './import/table-store';
import { decryptSecret } from './secret.util';

const TICK_MS = 60_000;

type Config = Record<string, unknown>;

@Injectable()
export class SheetSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SheetSyncService.name);
  private readonly running = new Set<string>();
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: TableStore,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopping = true;
    clearInterval(this.timer);
  }

  isRunning(id: string): boolean {
    return this.running.has(id);
  }

  /** Downloads the sheet and swaps in its data. A failure keeps the old data and is recorded in `lastSyncError`. */
  async sync(id: string): Promise<void> {
    if (this.running.has(id)) throw new BadRequestException('Sync already running');
    this.running.add(id);
    try {
      const ds = await this.prisma.datasource.findUnique({ where: { id } });
      if (!ds) throw new NotFoundException(`Datasource ${id} not found`);
      if (ds.type !== 'gsheet') throw new BadRequestException('Only Google Sheets sources can be synced');
      const config = ds.config as Config;
      await this.patch(id, { lastAttemptAt: new Date().toISOString() });
      try {
        await this.import(id, config);
      } catch (e) {
        const error = this.plain(id, e);
        await this.patch(id, { lastSyncError: error.message }).catch(() => undefined);
        throw error;
      }
      await this.patch(id, { lastSyncAt: new Date().toISOString(), lastSyncError: null });
    } finally {
      this.running.delete(id);
    }
  }

  private async import(id: string, config: Config): Promise<void> {
    const serviceAccount = typeof config.encryptedServiceAccount === 'string' ? decryptSecret(config.encryptedServiceAccount) : undefined;
    const dir = await mkdtemp(join(tmpdir(), 'paarvix-gsheet-'));
    try {
      const path = join(dir, `${randomUUID()}.xlsx`);
      await downloadSheet(String(config.spreadsheetId), serviceAccount, path);
      await this.store.replaceAll(id, path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Plain messages pass through. Anything else may carry key or cell content, so only its class is logged. */
  private plain(id: string, e: unknown): Error {
    this.logger.warn(`Sync failed for ${id}: ${(e as Error)?.constructor?.name ?? 'unknown'}`);
    return e instanceof HttpException ? e : new BadRequestException('Could not read this sheet');
  }

  /** Reads the current row first, so nothing a concurrent change wrote is overwritten. */
  private async patch(id: string, values: Config): Promise<void> {
    const row = await this.prisma.datasource.findUnique({ where: { id } });
    if (!row) return;
    const config = { ...(row.config as Config), ...values };
    if (config.lastSyncError === null) delete config.lastSyncError;
    // updateMany: a row removed in the meantime gives count 0 instead of an error.
    await this.prisma.datasource.updateMany({ where: { id }, data: { config: config as any } });
  }

  static isDue(config: Config, now: number): boolean {
    const minutes = Number(config.syncMinutes);
    if (!Number.isFinite(minutes) || minutes < 15) return false;
    const last = Math.max(Date.parse(String(config.lastSyncAt)) || 0, Date.parse(String(config.lastAttemptAt)) || 0);
    return now - last >= minutes * 60_000;
  }

  /** One source at a time. A slow tick makes the next one skip rather than overlap. */
  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const sources = await this.prisma.datasource.findMany({ where: { type: 'gsheet' }, select: { id: true, config: true } });
      for (const s of sources) {
        if (this.stopping) return;
        if (!SheetSyncService.isDue(s.config as Config, Date.now())) continue;
        await this.sync(s.id).catch(() => undefined); // already recorded and logged by sync
      }
    } catch (e) {
      this.logger.warn(`Sync check failed: ${(e as Error)?.constructor?.name ?? 'unknown'}`);
    } finally {
      this.ticking = false;
    }
  }
}
