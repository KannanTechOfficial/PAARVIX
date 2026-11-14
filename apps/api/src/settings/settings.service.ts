/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthUser, can } from '../access/auth-user';
import { FeaturesService } from '../access/features.service';

/** Theme layer 1: tokens only. No CSS, no scripts, no URLs. */
export interface ThemeTokens {
  primary: string;
  accent: string;
  warn: string;
  radius: number;
  density: 'comfortable' | 'compact';
}

export interface OrgSettings {
  name: string;
  defaultLanguage: 'en' | 'ta';
}

export const DEFAULT_THEME: ThemeTokens = {
  primary: '#1E3A8A',
  accent: '#14B8A6',
  warn: '#F97316',
  radius: 8,
  density: 'comfortable',
};

export const DEFAULT_ORG: OrgSettings = { name: 'Paarvix', defaultLanguage: 'en' };

const HEX = /^#[0-9a-fA-F]{6}$/;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
  ) {}

  private async read<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row ? { ...fallback, ...(row.value as object) } : fallback;
  }

  private write(key: string, value: object) {
    return this.prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  /** Readable by every signed-in user, since the app needs the theme and name to draw itself. */
  async getAll() {
    return { org: await this.read('org', DEFAULT_ORG), theme: await this.read('theme', DEFAULT_THEME) };
  }

  private cleanOrg(input: Partial<OrgSettings>, base: OrgSettings): OrgSettings {
    const out = { ...base };
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (name.length < 2 || name.length > 80) throw new BadRequestException('Organisation name must be 2 to 80 characters');
      out.name = name;
    }
    if (input.defaultLanguage !== undefined) {
      if (input.defaultLanguage !== 'en' && input.defaultLanguage !== 'ta') throw new BadRequestException('Language must be en or ta');
      out.defaultLanguage = input.defaultLanguage;
    }
    return out;
  }

  private cleanTheme(input: Partial<ThemeTokens>, base: ThemeTokens): ThemeTokens {
    const out = { ...base };
    for (const key of ['primary', 'accent', 'warn'] as const) {
      if (input[key] !== undefined) {
        if (!HEX.test(String(input[key]))) throw new BadRequestException(`${key} must be a colour like #1E3A8A`);
        out[key] = String(input[key]).toUpperCase();
      }
    }
    if (input.radius !== undefined) {
      const r = Number(input.radius);
      if (!Number.isInteger(r) || r < 0 || r > 16) throw new BadRequestException('Corner radius must be 0 to 16');
      out.radius = r;
    }
    if (input.density !== undefined) {
      if (input.density !== 'comfortable' && input.density !== 'compact') throw new BadRequestException('Density must be comfortable or compact');
      out.density = input.density;
    }
    return out;
  }

  async update(body: { org?: Partial<OrgSettings>; theme?: Partial<ThemeTokens> }, user: AuthUser) {
    const unknown = Object.keys(body ?? {}).filter((k) => k !== 'org' && k !== 'theme');
    if (unknown.length) throw new BadRequestException(`Unknown setting: ${unknown[0].slice(0, 40)}`);
    const current = await this.getAll();

    if (body.org) {
      if (!can(user, 'settings:write')) throw new ForbiddenException('You cannot change organisation settings');
      await this.write('org', this.cleanOrg(body.org, current.org));
    }
    if (body.theme) {
      if (!can(user, 'theme:write')) throw new ForbiddenException('You cannot change the theme');
      this.features.assertEnabled('theme.custom');
      await this.write('theme', this.cleanTheme(body.theme, current.theme));
    }
    return this.getAll();
  }

  async resetTheme(user: AuthUser) {
    if (!can(user, 'theme:write')) throw new ForbiddenException('You cannot change the theme');
    await this.write('theme', DEFAULT_THEME);
    return this.getAll();
  }
}
