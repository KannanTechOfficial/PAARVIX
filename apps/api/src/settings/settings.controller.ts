/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { type OrgSettings, SettingsService, type ThemeTokens } from './settings.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AnyUser, PermissionsGuard } from '../access/permissions.guard';
import { type AuthUser, CurrentUser } from '../access/auth-user';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @AnyUser()
  getAll() {
    return this.settingsService.getAll();
  }

  /** Each section checks its own permission: settings:write for org, theme:write for theme. */
  @Patch()
  @AnyUser()
  update(@Body() body: { org?: Partial<OrgSettings>; theme?: Partial<ThemeTokens> }, @CurrentUser() user: AuthUser) {
    return this.settingsService.update(body, user);
  }

  @Post('theme/reset')
  @AnyUser()
  resetTheme(@CurrentUser() user: AuthUser) {
    return this.settingsService.resetTheme(user);
  }
}
