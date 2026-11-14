/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  DASHBOARD_COLUMNS, type DashboardConfig, type DashboardPanel, type DashboardSection, MAX_PANELS, MAX_SECTIONS, PANEL_ROLES, PANEL_VIZ_TYPES,
  type QuerySpec, emptyDashboardConfig, upgradeDashboardConfig,
} from '@paarvix/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DatasourcesService } from '../datasources/datasources.service';
import { type AuthUser, can, toSecurityContext } from '../access/auth-user';
import { RolesService } from '../access/roles.service';

export interface DashboardInput {
  title?: string;
  description?: string;
  config?: DashboardConfig;
  roleIds?: string[];
  version?: number;
}

type Row = Prisma.DashboardGetPayload<{ include: { viewers: true; creator: { select: { id: true; name: true } } } }>;

/** Template dashboards are hand-built college screens with their own routes; the builder does not edit them. */
const isTemplate = (d: { config: unknown }) => !!(d.config as { template?: string } | null)?.template;

const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown, max: number) => (v === undefined || v === null ? '' : String(v).slice(0, max));

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datasources: DatasourcesService,
    private readonly roles: RolesService,
  ) {}

  /**
   * "View as" one person: the dashboard and its data exactly as that person gets them, row rules included.
   * Only for people who manage dashboards and can see users.
   */
  private async actAs(user: AuthUser, asUserId?: string): Promise<AuthUser> {
    if (!asUserId) return user;
    if (!can(user, 'dashboards:write') || !can(user, 'users:read')) throw new ForbiddenException('You cannot preview as another person');
    const target = await this.roles.resolve(asUserId);
    if (!target) throw new NotFoundException('That person is inactive or has no role');
    return target;
  }

  /**
   * Whether this user may open the dashboard. Editors see every dashboard. Everyone else sees a built
   * dashboard only when their role is on its list. asRoleId previews what another role would see.
   */
  private visible(d: Row, user: AuthUser, asRoleId?: string): boolean {
    // A locked role sees its home dashboard and nothing else, whatever address is typed.
    if (user.locked && !asRoleId) return d.id === user.homeDashboardId;
    if (isTemplate(d)) return true; // unchanged: template screens apply their own checks
    if (!asRoleId && can(user, 'dashboards:write')) return true;
    const roleId = asRoleId ?? user.roleId;
    return d.viewers.some((v) => v.roleId === roleId);
  }

  /** Previewing as another role is only for people who manage dashboards and can see roles. */
  private previewRole(user: AuthUser, asRoleId?: string): string | undefined {
    if (!asRoleId) return undefined;
    if (!can(user, 'dashboards:write') || !can(user, 'roles:read')) throw new ForbiddenException('You cannot preview as another role');
    return asRoleId;
  }

  private view(d: Row, user: AuthUser) {
    const manager = can(user, 'dashboards:write');
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      slug: d.slug,
      template: (d.config as { template?: string } | null)?.template ?? null,
      config: isTemplate(d) ? null : (d.config as unknown as DashboardConfig),
      version: d.version,
      updatedAt: d.updatedAt,
      creator: d.creator,
      // Who can view is shown only to people who can change it.
      roleIds: manager ? d.viewers.map((v) => v.roleId) : undefined,
      canEdit: manager && !isTemplate(d),
    };
  }

  private load(id: string) {
    return this.prisma.dashboard.findUnique({
      where: { id },
      include: { viewers: true, creator: { select: { id: true, name: true } } },
    });
  }

  async findAll(user: AuthUser, asRoleId?: string) {
    const role = this.previewRole(user, asRoleId);
    const all = await this.prisma.dashboard.findMany({
      include: { viewers: true, creator: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return all.filter((d) => this.visible(d, user, role)).map((d) => this.view(d, user));
  }

  async findById(id: string, caller: AuthUser, asRoleId?: string, asUserId?: string) {
    const user = await this.actAs(caller, asUserId);
    const role = this.previewRole(caller, asRoleId);
    const d = await this.load(id);
    // "Not found" for both cases, so ids of hidden dashboards are not confirmed.
    if (!d || !this.visible(d, user, role)) throw new NotFoundException('Dashboard not found');
    return this.view(d, user);
  }

  private async cleanRoles(roleIds: unknown): Promise<string[]> {
    if (roleIds === undefined) return [];
    if (!Array.isArray(roleIds) || roleIds.some((r) => typeof r !== 'string')) throw new BadRequestException('roleIds must be a list');
    const ids = [...new Set(roleIds as string[])];
    if ((await this.prisma.role.count({ where: { id: { in: ids } } })) !== ids.length) throw new BadRequestException('Unknown role');
    return ids;
  }

  /** Checks every field, and that each panel's saved query is one the saving user may use. */
  private async cleanConfig(raw: unknown, user: AuthUser): Promise<DashboardConfig> {
    const c = raw as DashboardConfig | undefined;
    if (!c || (c.schemaVersion !== 1 && c.schemaVersion !== 2) || !Array.isArray(c.panels)) throw new BadRequestException('This dashboard layout is not valid');
    if (c.panels.length > MAX_PANELS) throw new BadRequestException(`A dashboard can have at most ${MAX_PANELS} panels`);
    const sections: DashboardSection[] = [];
    for (const s of c.sections ?? []) {
      if (typeof s?.id !== 'string' || !/^[\w-]{1,40}$/.test(s.id) || sections.some((x) => x.id === s.id)) throw new BadRequestException('Each section needs a unique id');
      sections.push({ id: s.id, title: text(s.title, 60).trim() });
    }
    if (sections.length > MAX_SECTIONS) throw new BadRequestException(`A dashboard can have at most ${MAX_SECTIONS} sections`);
    const ids = new Set<string>();
    const panels: DashboardPanel[] = [];
    for (const p of c.panels) {
      if (typeof p?.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id) || ids.has(p.id)) throw new BadRequestException('Each panel needs a unique id');
      ids.add(p.id);
      if (!PANEL_VIZ_TYPES.includes(p.viz?.type)) throw new BadRequestException('Unknown panel type');
      if (!int(p.x, 0, DASHBOARD_COLUMNS - 1) || !int(p.w, 1, DASHBOARD_COLUMNS) || p.x + p.w > DASHBOARD_COLUMNS || !int(p.y, 0, 1000) || !int(p.h, 1, 24)) {
        throw new BadRequestException('A panel is outside the grid');
      }
      if (p.role !== undefined && !PANEL_ROLES.includes(p.role)) throw new BadRequestException('Unknown panel role');
      if (p.section !== undefined && !sections.some((s) => s.id === p.section)) throw new BadRequestException('A panel is in a section that does not exist');
      const panel: DashboardPanel = {
        id: p.id,
        title: text(p.title, 100),
        role: p.role,
        section: p.section,
        x: p.x, y: p.y, w: p.w, h: p.h,
        viz: {
          type: p.viz.type,
          label: text(p.viz.label, 100) || undefined,
          value: text(p.viz.value, 100) || undefined,
          unit: text(p.viz.unit, 8) || undefined,
          goodWhen: p.viz.goodWhen === 'up' || p.viz.goodWhen === 'down' ? p.viz.goodWhen : undefined,
          text: p.viz.type === 'text' ? text(p.viz.text, 2000) : undefined,
        },
      };
      if (p.viz.type !== 'text') {
        if (typeof p.queryId !== 'string' || !p.queryId) throw new BadRequestException(`Panel "${panel.title || p.id}" needs a saved query`);
        panel.queryId = p.queryId;
      }
      panels.push(panel);
    }
    const queryIds = [...new Set(panels.map((p) => p.queryId).filter((q): q is string => !!q))];
    const queries = await this.prisma.query.findMany({ where: { id: { in: queryIds } } });
    for (const qid of queryIds) {
      const q = queries.find((x) => x.id === qid);
      // A panel may only use your own queries or shared ones on sources you may use, never someone's private query.
      if (!q || (q.createdBy !== user.id && q.visibility !== 'shared' && !user.isSuperAdmin)) {
        throw new BadRequestException('A panel uses a saved query you cannot use');
      }
      await this.datasources.assertCanUse(q.datasourceId, user);
    }
    // Stored at the current version: missing roles and sections are filled in the same way the viewer does.
    return upgradeDashboardConfig({ schemaVersion: 2, sections, panels });
  }

  async create(input: DashboardInput, user: AuthUser) {
    const title = text(input?.title, 120).trim();
    if (title.length < 2) throw new BadRequestException('Title must be at least 2 characters');
    const roleIds = await this.cleanRoles(input.roleIds);
    const d = await this.prisma.dashboard.create({
      data: {
        title,
        description: text(input.description, 300).trim() || null,
        slug: `d-${randomBytes(6).toString('hex')}`,
        config: emptyDashboardConfig() as unknown as Prisma.InputJsonValue,
        createdBy: user.id,
        viewers: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      include: { viewers: true, creator: { select: { id: true, name: true } } },
    });
    return this.view(d, user);
  }

  /** Saves only when the caller edited the latest version; otherwise someone else's save would be overwritten. */
  async update(id: string, input: DashboardInput, user: AuthUser) {
    const d = await this.load(id);
    if (!d) throw new NotFoundException('Dashboard not found');
    if (isTemplate(d)) throw new BadRequestException('Template dashboards cannot be edited here');
    if (input.version !== d.version) throw new ConflictException('Someone else saved this dashboard since you opened it. Reload to see their changes.');

    const data: Prisma.DashboardUpdateInput = { version: { increment: 1 } };
    if (input.title !== undefined) {
      const title = text(input.title, 120).trim();
      if (title.length < 2) throw new BadRequestException('Title must be at least 2 characters');
      data.title = title;
    }
    if (input.description !== undefined) data.description = text(input.description, 300).trim() || null;
    if (input.config !== undefined) data.config = (await this.cleanConfig(input.config, user)) as unknown as Prisma.InputJsonValue;

    const roleIds = input.roleIds !== undefined ? await this.cleanRoles(input.roleIds) : null;
    const saved = await this.prisma.$transaction(async (tx) => {
      // The version is checked again inside the transaction, in case two saves arrive together.
      const n = await tx.dashboard.updateMany({ where: { id, version: d.version }, data: { version: { increment: 1 } } });
      if (n.count !== 1) throw new ConflictException('Someone else saved this dashboard since you opened it. Reload to see their changes.');
      const { version: _v, ...rest } = data;
      await tx.dashboard.update({ where: { id }, data: rest });
      if (roleIds) {
        await tx.dashboardRole.deleteMany({ where: { dashboardId: id } });
        await tx.dashboardRole.createMany({ data: roleIds.map((roleId) => ({ dashboardId: id, roleId })) });
      }
      return tx.dashboard.findUniqueOrThrow({ where: { id }, include: { viewers: true, creator: { select: { id: true, name: true } } } });
    });
    return this.view(saved, user);
  }

  async remove(id: string) {
    const d = await this.load(id);
    if (!d) throw new NotFoundException('Dashboard not found');
    if (isTemplate(d)) throw new BadRequestException('Remove template dashboards from the Templates page');
    await this.prisma.dashboard.delete({ where: { id } });
    return { removed: id };
  }

  /**
   * Runs one panel's saved query. The viewer sends only the dashboard and panel ids; the server finds
   * the query itself. So a viewer needs no access to the data source, and cannot run anything else.
   */
  async panelData(id: string, panelId: string, caller: AuthUser, asRoleId?: string, asUserId?: string) {
    const user = await this.actAs(caller, asUserId);
    const role = this.previewRole(caller, asRoleId);
    const d = await this.load(id);
    if (!d || isTemplate(d) || !this.visible(d, user, role)) throw new NotFoundException('Dashboard not found');
    const panel = (d.config as unknown as DashboardConfig).panels?.find((p) => p.id === panelId);
    if (!panel?.queryId) throw new NotFoundException('Panel not found');
    const q = await this.prisma.query.findUnique({ where: { id: panel.queryId } });
    if (!q) throw new NotFoundException('The saved query behind this panel was deleted');

    const ctx = toSecurityContext(user);
    const started = Date.now();
    const result = q.kind === 'sql'
      ? await this.datasources.query(q.datasourceId, q.sql ?? '', [], ctx)
      : await this.datasources.data(q.datasourceId, q.querySpec as unknown as QuerySpec, ctx);
    return { ...result, durationMs: Date.now() - started, ranAt: new Date().toISOString() };
  }
}
