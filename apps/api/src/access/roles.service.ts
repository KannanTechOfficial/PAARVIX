/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { BUILT_IN_ROLES, LEGACY_ROLE_MAP, SUPER_ADMIN, isPermission } from '@paarvix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FeaturesService } from './features.service';
import type { AuthUser } from './auth-user';

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
  ) {}

  /** Keeps built-in roles current and moves users from the old role column. Safe to repeat. */
  async onModuleInit() {
    for (const r of BUILT_IN_ROLES) {
      await this.prisma.role.upsert({
        where: { key: r.key },
        update: { name: r.name, description: r.description, permissions: r.permissions, isSystem: true },
        create: { key: r.key, name: r.name, description: r.description, permissions: r.permissions, isSystem: true },
      });
    }

    const unassigned = await this.prisma.user.findMany({ where: { roleId: null }, orderBy: { createdAt: 'asc' } });
    if (unassigned.length === 0) return;
    const roles = new Map((await this.prisma.role.findMany()).map((r) => [r.key, r.id]));
    const hasSuper = (await this.prisma.user.count({ where: { assignedRole: { key: SUPER_ADMIN } } })) > 0;
    let superGiven = hasSuper;
    for (const u of unassigned) {
      // The oldest admin ran the setup wizard, so they become the Super Admin.
      const key = !superGiven && u.role === 'ADMIN' ? SUPER_ADMIN : LEGACY_ROLE_MAP[u.role] ?? 'viewer';
      if (key === SUPER_ADMIN) superGiven = true;
      await this.prisma.user.update({ where: { id: u.id }, data: { roleId: roles.get(key) } });
    }
    this.logger.log(`Moved ${unassigned.length} user(s) onto roles`);
  }

  /** The signed-in user with their current role. Null when the account is missing, inactive or has no role. */
  async resolve(userId: string): Promise<AuthUser | null> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { assignedRole: true } });
    if (!u || !u.isActive || !u.assignedRole) return null;
    const r = u.assignedRole;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      language: u.language,
      department: u.department,
      roleId: r.id,
      role: r.key,
      roleName: r.name,
      permissions: r.permissions,
      isSuperAdmin: r.key === SUPER_ADMIN,
      homeDashboardId: u.homeDashboardId ?? r.homeDashboardId ?? null,
      attributes: {
        ...Object.fromEntries(Object.entries((u.attributes ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)])),
        email: u.email,
        ...(u.department ? { department: u.department } : {}),
      },
      // Never lock a Super Admin out of the controls, and only lock when there is a home to show.
      locked: r.key !== SUPER_ADMIN && r.lockToHome && !!(u.homeDashboardId ?? r.homeDashboardId),
    };
  }

  async idFor(key: string): Promise<string> {
    const role = await this.prisma.role.findUnique({ where: { key } });
    if (!role) throw new NotFoundException(`Role ${key} not found`);
    return role.id;
  }

  list() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  private clean(input: RoleInput) {
    const name = String(input.name ?? '').trim();
    if (name.length < 2 || name.length > 60) throw new BadRequestException('Role name must be 2 to 60 characters');
    const permissions = [...new Set(input.permissions ?? [])];
    const unknown = permissions.filter((p) => !isPermission(p));
    if (unknown.length) throw new BadRequestException(`Unknown permission: ${unknown[0].slice(0, 40)}`);
    const description = String(input.description ?? '').trim().slice(0, 200);
    return { name, description, permissions };
  }

  /** Nobody can hand out a permission they do not hold. */
  private assertCanGrant(actor: AuthUser, permissions: string[]) {
    if (actor.isSuperAdmin) return;
    const missing = permissions.find((p) => !actor.permissions.includes(p));
    if (missing) throw new ForbiddenException(`You cannot grant ${missing}, because you do not have it`);
  }

  async create(input: RoleInput, actor: AuthUser) {
    this.features.assertEnabled('roles.custom');
    const data = this.clean(input);
    this.assertCanGrant(actor, data.permissions);
    const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'role';
    let key = KEY_PATTERN.test(base) ? base : `role_${base}`.slice(0, 40);
    for (let n = 2; await this.prisma.role.findUnique({ where: { key } }); n++) key = `${base}_${n}`;
    return this.prisma.role.create({ data: { ...data, key, isSystem: false } });
  }

  private async editable(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('Built-in roles cannot be changed. Copy it to make your own.');
    return role;
  }

  async update(id: string, input: RoleInput, actor: AuthUser) {
    this.features.assertEnabled('roles.custom');
    await this.editable(id);
    const data = this.clean(input);
    this.assertCanGrant(actor, data.permissions);
    return this.prisma.role.update({ where: { id }, data });
  }

  /**
   * Sets the dashboard a role opens after sign-in, and whether it sees only that dashboard.
   * Works on built-in roles too. The role is given view access to the dashboard if it lacks it.
   */
  async setHome(id: string, input: { homeDashboardId?: string | null; lockToHome?: boolean }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.key === SUPER_ADMIN && input.lockToHome) throw new BadRequestException('Super Admin can never be limited to one dashboard');
    const homeDashboardId = input.homeDashboardId ? String(input.homeDashboardId) : null;
    if (homeDashboardId) {
      const d = await this.prisma.dashboard.findUnique({ where: { id: homeDashboardId } });
      if (!d) throw new BadRequestException('Dashboard not found');
      await this.prisma.dashboardRole.upsert({
        where: { dashboardId_roleId: { dashboardId: homeDashboardId, roleId: id } },
        update: {},
        create: { dashboardId: homeDashboardId, roleId: id },
      });
    }
    return this.prisma.role.update({
      where: { id },
      data: { homeDashboardId, lockToHome: !!input.lockToHome && !!homeDashboardId },
    });
  }

  async remove(id: string) {
    this.features.assertEnabled('roles.custom');
    await this.editable(id);
    const users = await this.prisma.user.count({ where: { roleId: id } });
    if (users > 0) throw new ConflictException(`Move the ${users} user(s) with this role to another role first`);
    await this.prisma.role.delete({ where: { id } });
    return { removed: id };
  }
}
