/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SUPER_ADMIN } from '@paarvix/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../access/auth-user';
import { SessionsService } from '../auth/sessions.service';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
  language?: string;
  department?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  roleId?: string;
  isActive?: boolean;
  language?: string;
  department?: string | null;
  homeDashboardId?: string | null;
  attributes?: Record<string, string>;
}

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  language: true,
  department: true,
  homeDashboardId: true,
  attributes: true,
  createdAt: true,
  assignedRole: { select: { id: true, key: true, name: true } },
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANGUAGES = new Set(['en', 'ta']);
const MIN_PASSWORD = 8;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { createdAt: 'asc' } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async role(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: String(roleId ?? '') } });
    if (!role) throw new BadRequestException('Choose a role');
    return role;
  }

  /** Only a Super Admin can make, change or remove a Super Admin. */
  private assertMayTouch(actor: AuthUser, roleKey: string) {
    if (roleKey === SUPER_ADMIN && !actor.isSuperAdmin) {
      throw new ForbiddenException('Only a Super Admin can manage Super Admins');
    }
  }

  private async assertNotLastSuperAdmin(userId: string) {
    const others = await this.prisma.user.count({
      where: { id: { not: userId }, isActive: true, assignedRole: { key: SUPER_ADMIN } },
    });
    if (others === 0) throw new ConflictException('This is the last active Super Admin. Make someone else a Super Admin first.');
  }

  private text(value: unknown, field: string, min: number, max: number): string {
    const v = String(value ?? '').trim();
    if (v.length < min || v.length > max) throw new BadRequestException(`${field} must be ${min} to ${max} characters`);
    return v;
  }

  private language(value: unknown): string {
    const v = String(value ?? 'en');
    if (!LANGUAGES.has(v)) throw new BadRequestException('Language must be en or ta');
    return v;
  }

  /** Short key=value pairs for row rules. email and department come from the profile, so they are not stored here. */
  private attributes(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Attributes must be name and value pairs');
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 20) throw new BadRequestException('At most 20 attributes');
    const out: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) throw new BadRequestException(`"${k.slice(0, 40)}" is not a valid attribute name: use lower-case letters, digits and _`);
      if (k === 'email' || k === 'department') throw new BadRequestException(`${k} comes from the profile and cannot be set here`);
      const val = String(v ?? '').trim();
      if (val.length > 200) throw new BadRequestException(`The value of ${k} is too long`);
      if (val) out[k] = val;
    }
    return out;
  }

  private department(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    return this.text(value, 'Department', 1, 80);
  }

  async create(input: CreateUserInput, actor: AuthUser) {
    const role = await this.role(input.roleId);
    this.assertMayTouch(actor, role.key);
    const email = String(input.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200) throw new BadRequestException('Enter a valid email');
    if (String(input.password ?? '').length < MIN_PASSWORD) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('A user with this email already exists');

    return this.prisma.user.create({
      data: {
        email,
        name: this.text(input.name, 'Name', 2, 100),
        passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
        roleId: role.id,
        language: this.language(input.language),
        department: this.department(input.department),
      },
      select: PUBLIC_FIELDS,
    });
  }

  async update(id: string, input: UpdateUserInput, actor: AuthUser) {
    const current = await this.prisma.user.findUnique({ where: { id }, include: { assignedRole: true } });
    if (!current) throw new NotFoundException('User not found');
    const currentKey = current.assignedRole?.key ?? '';
    this.assertMayTouch(actor, currentKey);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = this.text(input.name, 'Name', 2, 100);
    if (input.language !== undefined) data.language = this.language(input.language);
    if (input.department !== undefined) data.department = this.department(input.department);
    if (input.attributes !== undefined) data.attributes = this.attributes(input.attributes);
    if (input.homeDashboardId !== undefined) {
      const home = input.homeDashboardId ? String(input.homeDashboardId) : null;
      if (home) {
        const d = await this.prisma.dashboard.findUnique({ where: { id: home }, include: { viewers: true } });
        if (!d) throw new BadRequestException('Dashboard not found');
        const roleId = (input.roleId as string | undefined) ?? current.roleId;
        if (!d.viewers.some((v) => v.roleId === roleId) && currentKey !== SUPER_ADMIN) {
          throw new BadRequestException("This person's role cannot view that dashboard. Give the role access to it first.");
        }
      }
      data.homeDashboardId = home;
    }

    let leavesSuperAdmin = false;
    if (input.roleId !== undefined && input.roleId !== current.roleId) {
      const role = await this.role(input.roleId);
      this.assertMayTouch(actor, role.key);
      data.roleId = role.id;
      leavesSuperAdmin = currentKey === SUPER_ADMIN;
    }
    if (input.isActive !== undefined) {
      if (input.isActive === false && id === actor.id) throw new BadRequestException('You cannot deactivate yourself');
      data.isActive = Boolean(input.isActive);
      if (!data.isActive) data.sessionVersion = { increment: 1 }; // ends their open sessions
      if (!data.isActive && currentKey === SUPER_ADMIN) leavesSuperAdmin = true;
    }
    if (leavesSuperAdmin) await this.assertNotLastSuperAdmin(id);

    const updated = await this.prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
    // A deactivated person is signed out on every device at once, not when their tokens expire.
    if (data.isActive === false) await this.sessions.revokeAll(id, 'deactivated');
    return updated;
  }

  async setPassword(id: string, password: string, actor: AuthUser) {
    const current = await this.prisma.user.findUnique({ where: { id }, include: { assignedRole: true } });
    if (!current) throw new NotFoundException('User not found');
    this.assertMayTouch(actor, current.assignedRole?.key ?? '');
    if (String(password ?? '').length < MIN_PASSWORD) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), sessionVersion: { increment: 1 } },
    });
    // A new password signs them out everywhere. Someone resetting their own keeps the device they are on.
    await this.sessions.revokeAll(id, 'password_reset', id === actor.id ? actor.sessionId : undefined);
    return { updated: id };
  }

  /** The devices a person is signed in on, for an administrator. */
  async listSessions(id: string, actor: AuthUser) {
    await this.touchable(id, actor);
    return this.sessions.listActive(id);
  }

  /** Signs a person out on every device. Used when a laptop or phone is lost, or someone leaves. */
  async revokeSessions(id: string, actor: AuthUser) {
    await this.touchable(id, actor);
    // An admin signing themselves out everywhere keeps the device they are using.
    const ended = await this.sessions.revokeAll(id, 'admin', id === actor.id ? actor.sessionId : undefined);
    return { ended };
  }

  private async touchable(id: string, actor: AuthUser) {
    const current = await this.prisma.user.findUnique({ where: { id }, include: { assignedRole: true } });
    if (!current) throw new NotFoundException('User not found');
    this.assertMayTouch(actor, current.assignedRole?.key ?? '');
  }
}
