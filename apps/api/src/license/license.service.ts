/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createPublicKey, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  LICENSE_GRACE_DAYS,
  type Edition,
  type Feature,
  type LicensePayload,
  type LicenseStatus,
  featureAllowed,
} from '@paarvix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LICENSE_PUBLIC_KEY } from './public-key';
import { verifyLicense } from './verify-license';

const DAY = 86_400_000;
const KEY_SETTING = 'license';
const INSTANCE_SETTING = 'instance_id';

/**
 * Reads and checks the Pro or Enterprise licence. Works fully offline: a licence is a signed key,
 * checked here against KannanTech's public key, with no call home.
 *
 * Without a licence Paarvix is Community, and every Community feature works. When a licence
 * expires, paid features keep working for a grace period, then switch off. Nothing else changes:
 * nobody is locked out and no data is hidden.
 */
@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private readonly publicKey = createPublicKey(LICENSE_PUBLIC_KEY);
  private payload: LicensePayload | null = null;
  private problem: string | undefined;
  private fromEnvironment = false;
  private instanceId = '';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.instanceId = await this.ensureInstanceId();
    await this.load();
    const s = this.status();
    if (s.state === 'community') this.logger.log('Community edition');
    else if (s.state === 'invalid') this.logger.warn(`Licence refused: ${s.problem}`);
    else this.logger.log(`${s.licensedEdition} licence for ${s.customer}: ${s.state}, expires ${s.expiresAt?.slice(0, 10)}`);
  }

  /** The licence's state right now. Expiry is worked out on each call, so no restart is needed when a date passes. */
  status(now = Date.now()): LicenseStatus {
    const base = { instanceId: this.instanceId, fromEnvironment: this.fromEnvironment };
    if (!this.payload) {
      return this.problem
        ? { ...base, state: 'invalid', edition: 'community', problem: this.problem }
        : { ...base, state: 'community', edition: 'community' };
    }
    const p = this.payload;
    const expires = Date.parse(p.expiresAt);
    const graceEnds = expires + LICENSE_GRACE_DAYS * DAY;
    const state = now < expires ? 'active' : now < graceEnds ? 'grace' : 'expired';
    return {
      ...base,
      state,
      edition: state === 'expired' ? 'community' : p.edition,
      customer: p.customer,
      licenseId: p.id,
      licensedEdition: p.edition,
      expiresAt: p.expiresAt,
      graceEndsAt: new Date(graceEnds).toISOString(),
      daysLeft: Math.ceil((expires - now) / DAY),
      limits: p.limits,
    };
  }

  edition(): Edition {
    return this.status().edition;
  }

  /** True when this install may use the feature now. Community features are always true. */
  allows(feature: Feature): boolean {
    const s = this.status();
    const extra = s.state === 'active' || s.state === 'grace' ? (this.payload?.features ?? []) : [];
    return featureAllowed(feature, s.edition, extra);
  }

  /** Saves a licence pasted in Administration. Works offline. */
  async activate(key: string): Promise<LicenseStatus> {
    if (this.fromEnvironment) {
      throw new ConflictException('The licence is set by the PAARVIX_LICENSE setting on the server. Change it there.');
    }
    const result = this.check(String(key ?? ''));
    if (!result.ok) throw new BadRequestException(result.problem);
    if (Date.parse(result.payload.expiresAt) + LICENSE_GRACE_DAYS * DAY <= Date.now()) {
      throw new BadRequestException('This licence has expired. Ask support@kannantech.com to renew it.');
    }
    await this.prisma.setting.upsert({
      where: { key: KEY_SETTING },
      create: { key: KEY_SETTING, value: { key: String(key).trim() } },
      update: { value: { key: String(key).trim() } },
    });
    this.payload = result.payload;
    this.problem = undefined;
    this.logger.log(`Licence activated: ${result.payload.edition} for ${result.payload.customer}`);
    return this.status();
  }

  /** Removes the saved licence; Paarvix goes back to Community. */
  async remove(): Promise<LicenseStatus> {
    if (this.fromEnvironment) {
      throw new ConflictException('The licence is set by the PAARVIX_LICENSE setting on the server. Remove it there.');
    }
    await this.prisma.setting.deleteMany({ where: { key: KEY_SETTING } });
    this.payload = null;
    this.problem = undefined;
    this.logger.log('Licence removed: Community edition');
    return this.status();
  }

  /** The server's setting wins over a key saved from the screen, so an operator can manage it as code. */
  private async load() {
    const fromEnv = process.env.PAARVIX_LICENSE?.trim() || this.readLicenseFile();
    this.fromEnvironment = !!fromEnv;
    let key = fromEnv;
    if (!key) {
      const row = await this.prisma.setting.findUnique({ where: { key: KEY_SETTING } });
      key = typeof (row?.value as { key?: unknown } | null)?.key === 'string' ? (row!.value as { key: string }).key : undefined;
    }
    if (!key) return;
    const result = this.check(key);
    if (result.ok) this.payload = result.payload;
    else this.problem = result.problem;
  }

  private check(key: string) {
    const result = verifyLicense(key, this.publicKey);
    if (result.ok && result.payload.instanceId && result.payload.instanceId !== this.instanceId) {
      return { ok: false as const, problem: `This licence is for another server. This server's id is ${this.instanceId}.` };
    }
    return result;
  }

  private readLicenseFile(): string | undefined {
    const path = process.env.PAARVIX_LICENSE_FILE?.trim();
    if (!path) return undefined;
    try {
      return readFileSync(path, 'utf8').trim() || undefined;
    } catch {
      this.logger.warn(`PAARVIX_LICENSE_FILE could not be read: ${path}`);
      return undefined;
    }
  }

  /** A random id made once per install, shown to admins for licences bound to one server. */
  private async ensureInstanceId(): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key: INSTANCE_SETTING } });
    const existing = (row?.value as { id?: unknown } | null)?.id;
    if (typeof existing === 'string' && existing) return existing;
    const id = randomUUID();
    await this.prisma.setting.upsert({
      where: { key: INSTANCE_SETTING },
      create: { key: INSTANCE_SETTING, value: { id } },
      update: { value: { id } },
    });
    return id;
  }
}
