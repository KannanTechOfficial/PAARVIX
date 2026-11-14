/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PERMISSION_GROUPS, PERMISSIONS } from '@paarvix/shared';
import { JwtAuthGuard } from '../auth/auth.guard';
import { type AuthUser, CurrentUser } from './auth-user';
import { FeaturesService } from './features.service';
import { PermissionsGuard, RequirePermissions } from './permissions.guard';
import { type RoleInput, RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly features: FeaturesService,
  ) {}

  @Get()
  @RequirePermissions('roles:read')
  async list() {
    const roles = await this.roles.list();
    return roles.map(({ _count, ...r }) => ({ ...r, userCount: _count.users }));
  }

  @Get('permissions')
  @RequirePermissions('roles:read')
  catalog() {
    return {
      groups: PERMISSION_GROUPS.map((g) => ({
        ...g,
        permissions: g.permissions.map((id) => ({ id, label: PERMISSIONS[id] })),
      })),
      features: this.features.list(),
    };
  }

  @Post()
  @RequirePermissions('roles:write')
  create(@Body() body: RoleInput, @CurrentUser() user: AuthUser) {
    return this.roles.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions('roles:write')
  update(@Param('id') id: string, @Body() body: RoleInput, @CurrentUser() user: AuthUser) {
    return this.roles.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('roles:write')
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}
