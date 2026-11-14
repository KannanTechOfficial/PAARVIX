/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AnyUser, PermissionsGuard, RequirePermissions } from '../access/permissions.guard';
import { type AuthUser, CurrentUser } from '../access/auth-user';
import { FeaturesService } from '../access/features.service';
import { LicenseService } from './license.service';

@Controller('license')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LicenseController {
  constructor(
    private readonly license: LicenseService,
    private readonly features: FeaturesService,
  ) {}

  /** The edition in force and which features it turns on, for showing badges. Never the licence itself. */
  @Get('edition')
  @AnyUser()
  edition() {
    return { edition: this.license.edition(), features: this.features.list() };
  }

  /** Full licence status for administrators. */
  @Get()
  @RequirePermissions('settings:write')
  status() {
    return { ...this.license.status(), features: this.features.list() };
  }

  /** Only a Super Admin may add or remove the licence. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings:write')
  activate(@Body() body: { key?: string }, @CurrentUser() user: AuthUser) {
    if (!user.isSuperAdmin) throw new ForbiddenException('Only a Super Admin can change the licence');
    return this.license.activate(String(body?.key ?? ''));
  }

  @Delete()
  @RequirePermissions('settings:write')
  remove(@CurrentUser() user: AuthUser) {
    if (!user.isSuperAdmin) throw new ForbiddenException('Only a Super Admin can change the licence');
    return this.license.remove();
  }
}
