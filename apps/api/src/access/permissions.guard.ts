/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@paarvix/shared';
import { type AuthUser, can } from './auth-user';

const PERMISSIONS_KEY = 'pvx:permissions';
const ANY_USER_KEY = 'pvx:any-user';

/** The route needs every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Any signed-in user may call the route. Must be stated, so a forgotten decorator fails closed. */
export const AnyUser = () => SetMetadata(ANY_USER_KEY, true);

/**
 * Runs after JwtAuthGuard. A route with neither decorator is refused,
 * so a new route is closed until someone decides who may call it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException();

    const needed = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);
    if (needed?.length) {
      if (needed.every((p) => can(user, p))) return true;
      throw new ForbiddenException('You do not have permission for this action');
    }
    if (this.reflector.getAllAndOverride<boolean>(ANY_USER_KEY, targets)) return true;
    throw new ForbiddenException('This action is not available');
  }
}
