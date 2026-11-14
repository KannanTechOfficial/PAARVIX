/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { SUPER_ADMIN } from '@paarvix/shared';
import { type AuthUser, can } from '../access/auth-user';
import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Filter, QuerySpec, SecurityContext } from '@paarvix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistry } from './connectors/connector-registry';
import type { LoadedDatasource } from './connectors/connector';
import { TableStore } from './import/table-store';
import { assertSpecShape } from './query-compiler';
import { decryptSecret, encryptSecret } from './secret.util';
import { SheetSyncService } from './sheet-sync.service';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

@Injectable()
export class DatasourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
    private readonly tableStore: TableStore,
    private readonly sheetSync: SheetSyncService,
  ) {}

  private readonly logger = new Logger(DatasourcesService.name);

  /** Plain messages pass through. Anything else may carry cell values, so only its type is logged. */
  private importError(e: unknown): Error {
    if (e instanceof HttpException) return e;
    this.logger.warn(`Import failed: ${(e as Error)?.name ?? 'unknown error'} ${(e as { code?: string })?.code ?? ''}`);
    return new BadRequestException('Could not read this file');
  }

  /** Secrets never leave the server. Each `encryptedX` becomes a `hasX` flag, and a stray plaintext secret is dropped. */
  private publicView<T extends { type: string; config: unknown }>(ds: T): T {
    const secrets = this.registry.allSecretFields();
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ds.config as Record<string, unknown>)) {
      if (k.startsWith('encrypted')) config[`has${k.slice('encrypted'.length)}`] = !!v;
      else if (!secrets.has(k)) config[k] = v;
    }
    return { ...ds, config };
  }

  private async load(id: string): Promise<LoadedDatasource> {
    const ds = await this.prisma.datasource.findUnique({ where: { id } });
    if (!ds) {
      throw new NotFoundException(`Datasource ${id} not found`);
    }
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ds.config as Record<string, unknown>)) {
      if (k.startsWith('encrypted')) {
        const name = k.slice('encrypted'.length);
        if (v) config[name[0].toLowerCase() + name.slice(1)] = decryptSecret(String(v));
      } else config[k] = v;
    }
    return { id: ds.id, type: ds.type, config };
  }

  /** Super Admin and anyone who manages data sources may use every source; others only the ones granted to their role. */
  private managesAll(user: AuthUser): boolean {
    return can(user, 'datasources:write');
  }

  async findAll(user: AuthUser) {
    const list = await this.prisma.datasource.findMany({
      where: this.managesAll(user) ? {} : { access: { some: { roleId: user.roleId } } },
      include: { creator: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((ds) => this.publicView(ds));
  }

  /** Throws unless the user's role may query this source. Answers "not found", so ids are not confirmed. */
  async assertCanUse(id: string, user: AuthUser) {
    if (this.managesAll(user)) return;
    const grant = await this.prisma.datasourceAccess.findUnique({
      where: { datasourceId_roleId: { datasourceId: id, roleId: user.roleId } },
    });
    if (!grant) throw new NotFoundException(`Datasource ${id} not found`);
  }

  // ---------- row rules ----------
  listRules() {
    return this.prisma.rowRule.findMany({
      orderBy: { createdAt: 'asc' },
      include: { datasource: { select: { name: true } }, role: { select: { name: true, key: true } } },
    });
  }

  async addRule(id: string, input: { roleId?: string; column?: string; attribute?: string }) {
    const column = String(input?.column ?? '').trim();
    const attribute = String(input?.attribute ?? '').trim();
    if (!column || column.length > 100) throw new BadRequestException('Choose a column');
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(attribute)) throw new BadRequestException('Attribute names use lower-case letters, digits and _');
    if (!(await this.prisma.datasource.findUnique({ where: { id } }))) throw new NotFoundException(`Datasource ${id} not found`);
    const role = await this.prisma.role.findUnique({ where: { id: String(input.roleId ?? '') } });
    if (!role) throw new BadRequestException('Choose a role');
    if (role.key === SUPER_ADMIN) throw new BadRequestException('Super Admin always sees every row');
    return this.prisma.rowRule.upsert({
      where: { datasourceId_roleId_column: { datasourceId: id, roleId: role.id, column } },
      update: { attribute },
      create: { datasourceId: id, roleId: role.id, column, attribute },
    });
  }

  async removeRule(ruleId: string) {
    await this.prisma.rowRule.delete({ where: { id: ruleId } }).catch(() => {
      throw new NotFoundException('Rule not found');
    });
    return { removed: ruleId };
  }

  /** Every source with the roles allowed to query it. */
  async accessMatrix() {
    const [sources, roles] = await Promise.all([
      this.prisma.datasource.findMany({
        select: { id: true, name: true, type: true, access: { select: { roleId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.findMany({ select: { id: true, key: true, name: true, permissions: true, isSystem: true }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] }),
    ]);
    return {
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isSystem: r.isSystem,
        alwaysAllowed: r.key === SUPER_ADMIN || r.permissions.includes('datasources:write'),
        canQuery: r.key === SUPER_ADMIN || r.permissions.includes('datasources:query'),
      })),
      sources: sources.map((s) => ({ id: s.id, name: s.name, type: s.type, roleIds: s.access.map((a) => a.roleId) })),
    };
  }

  async setAccess(id: string, roleIds: unknown) {
    if (!Array.isArray(roleIds) || roleIds.some((r) => typeof r !== 'string')) {
      throw new BadRequestException('roleIds must be a list');
    }
    if (!(await this.prisma.datasource.findUnique({ where: { id } }))) throw new NotFoundException(`Datasource ${id} not found`);
    const ids = [...new Set(roleIds as string[])];
    const found = await this.prisma.role.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Unknown role');
    await this.prisma.$transaction([
      this.prisma.datasourceAccess.deleteMany({ where: { datasourceId: id } }),
      this.prisma.datasourceAccess.createMany({ data: ids.map((roleId) => ({ datasourceId: id, roleId })) }),
    ]);
    return { id, roleIds: ids };
  }

  async create(data: { name: string; type: string; config: unknown; createdBy: string }) {
    const connector = this.registry.get(data.type);
    if (!data.name) {
      throw new BadRequestException('Name is required');
    }
    const validated = connector.validateConfig(data.config);
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(validated)) {
      if (!connector.secretFields.includes(k)) config[k] = v;
      else if (typeof v === 'string') config[`encrypted${cap(k)}`] = encryptSecret(v);
      else throw new BadRequestException(`${cap(k)} must be text`);
    }
    // A fresh attempt time keeps the timer from starting a second sync before the first one below.
    if (data.type === 'gsheet') config.lastAttemptAt = new Date().toISOString();
    const ds = await this.prisma.datasource.create({
      data: { name: data.name, type: data.type, config: config as any, createdBy: data.createdBy },
    });
    if (data.type !== 'gsheet') return this.publicView(ds);
    // The first sync runs now, so a link nobody can read is reported here and leaves nothing behind.
    try {
      await this.sheetSync.sync(ds.id);
    } catch (e) {
      // dropAll too: the import may have committed before a later step failed.
      await this.tableStore.dropAll(ds.id).catch(() => undefined);
      await this.prisma.datasource.deleteMany({ where: { id: ds.id } });
      throw e;
    }
    const fresh = await this.prisma.datasource.findUnique({ where: { id: ds.id } });
    if (!fresh) throw new BadRequestException('This data source was removed while it was being created');
    return this.publicView(fresh);
  }

  /** `file` is the path of an .xlsx the caller has already saved. If the first import fails, no data source is left behind. */
  async createFromUpload(name: string, file: string, userId: string) {
    const ds = await this.prisma.datasource.create({ data: { name, type: 'excel', config: {}, createdBy: userId } });
    try {
      await this.tableStore.replaceAll(ds.id, file);
    } catch (e) {
      await this.prisma.datasource.delete({ where: { id: ds.id } }).catch(() => undefined);
      throw this.importError(e);
    }
    return this.publicView(ds);
  }

  /** Checked before and after the file arrives, so a wrong target never fills the disk. */
  async uploadTarget(id: string) {
    const ds = await this.prisma.datasource.findUnique({ where: { id } });
    if (!ds) throw new NotFoundException(`Datasource ${id} not found`);
    if (ds.type !== 'excel') throw new BadRequestException('This data source does not accept uploads');
    return ds;
  }

  /** Swaps in the sheets of a new file. A failed import leaves the previous data as it was. */
  async replaceUpload(id: string, file: string) {
    const ds = await this.uploadTarget(id);
    try {
      await this.tableStore.replaceAll(id, file);
    } catch (e) {
      throw this.importError(e);
    }
    return this.publicView(ds);
  }

  async remove(id: string) {
    // A running import creates tables dropAll cannot see yet, and would leave them behind with no record.
    if (this.sheetSync.isRunning(id)) throw new BadRequestException('Sync is running, try again shortly');
    await this.tableStore.dropAll(id); // the cascade removes the rows of data_tables, not the tables themselves
    await this.prisma.datasource.delete({ where: { id } });
    return { removed: id };
  }

  async testConnection(id: string): Promise<{ status: string; message: string }> {
    try {
      const ds = await this.load(id);
      await this.registry.get(ds.type).testConnection(ds);
      return { status: 'ok', message: 'Connection successful' };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  async schema(id: string, _ctx: SecurityContext) {
    const ds = await this.load(id);
    return this.registry.get(ds.type).discoverSchema(ds);
  }

  /**
   * The row rules for this person's role on this source, as filters. Fails closed:
   * a rule whose attribute the person lacks refuses the query instead of dropping the rule.
   */
  async rowRulesFor(id: string, ctx: SecurityContext): Promise<{ column: string; filter: Filter }[]> {
    const rules = await this.prisma.rowRule.findMany({ where: { datasourceId: id, role: { key: ctx.role } } });
    return rules.map((r) => {
      const value = ctx.attributes?.[r.attribute];
      if (value === undefined || value === null || String(value).trim() === '') {
        throw new ForbiddenException(`Your account has no "${r.attribute}" set, so this data cannot be shown. Ask an administrator.`);
      }
      return { column: r.column, filter: { column: r.column, op: 'eq', value: String(value) } as Filter };
    });
  }

  async data(id: string, spec: QuerySpec, ctx: SecurityContext) {
    assertSpecShape(spec);
    const ds = await this.load(id);
    const connector = this.registry.get(ds.type);
    const rules = await this.rowRulesFor(id, ctx);
    if (rules.length) {
      // A table without the rule's column could only be shown in full, so it is refused.
      const table = (await connector.discoverSchema(ds)).find((t) => t.name === spec.table);
      const missing = rules.find((r) => !table?.columns.some((c) => c.name === r.column));
      if (missing) throw new ForbiddenException('This table is not available to you');
    }
    return connector.query(ds, spec, { ...ctx, rowFilters: [...ctx.rowFilters, ...rules.map((r) => r.filter)] });
  }

  async query(id: string, sql: string, values: unknown[], ctx: SecurityContext) {
    // Raw SQL cannot be filtered, so refuse it rather than skip the filters.
    if (ctx.rowFilters.length || (await this.rowRulesFor(id, ctx)).length) {
      throw new ForbiddenException('Raw SQL is not available with row filters');
    }
    const ds = await this.load(id);
    const connector = this.registry.get(ds.type);
    if (!connector.runSql) {
      throw new BadRequestException('SQL is not available for spreadsheet sources');
    }
    return connector.runSql(ds, sql, values, ctx);
  }
}
