/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SecurityContext } from '@paarvix/shared';

/** The signed-in user, rebuilt from the database on every request, so a role change applies at once. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  language: string;
  department: string | null;
  roleId: string;
  /** Role key, e.g. "editor". */
  role: string;
  roleName: string;
  permissions: string[];
  isSuperAdmin: boolean;
  /** The dashboard opened after sign-in: the person's own choice, else their role's. */
  homeDashboardId: string | null;
  /** Compared by row rules: the person's custom attributes plus email and department. */
  attributes: Record<string, string>;
  /** True when the role is set to show only the home dashboard. The API enforces it too. */
  locked: boolean;
  /** The server-side session this request belongs to. Set by the JWT strategy. */
  sessionId?: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});

export function can(user: AuthUser, permission: string): boolean {
  return user.isSuperAdmin || user.permissions.includes(permission);
}

/** Builds the context every data path needs. rowFilters stay empty until row rules exist. */
export function toSecurityContext(user: AuthUser): SecurityContext {
  return { userId: user.id, role: user.role, permissions: user.permissions, attributes: user.attributes, tenantId: null, rowFilters: [] };
}
