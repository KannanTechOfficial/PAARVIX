/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { DashboardsService, type DashboardInput } from './dashboards.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../access/permissions.guard';
import { type AuthUser, CurrentUser } from '../access/auth-user';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  /** ?asRole=<roleId> previews the list another role sees (managers only). */
  @Get()
  @RequirePermissions('dashboards:read')
  findAll(@CurrentUser() user: AuthUser, @Query('asRole') asRole?: string) {
    return this.dashboardsService.findAll(user, asRole || undefined);
  }

  @Get(':id')
  @RequirePermissions('dashboards:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('asRole') asRole?: string, @Query('asUser') asUser?: string) {
    return this.dashboardsService.findById(id, user, asRole || undefined, asUser || undefined);
  }

  @Post(':id/panels/:panelId/data')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('dashboards:read')
  panelData(
    @Param('id') id: string, @Param('panelId') panelId: string, @CurrentUser() user: AuthUser,
    @Query('asRole') asRole?: string, @Query('asUser') asUser?: string,
  ) {
    return this.dashboardsService.panelData(id, panelId, user, asRole || undefined, asUser || undefined);
  }

  @Post()
  @RequirePermissions('dashboards:write')
  create(@Body() body: DashboardInput, @CurrentUser() user: AuthUser) {
    return this.dashboardsService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('dashboards:write')
  update(@Param('id') id: string, @Body() body: DashboardInput, @CurrentUser() user: AuthUser) {
    return this.dashboardsService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('dashboards:delete')
  remove(@Param('id') id: string) {
    return this.dashboardsService.remove(id);
  }
}
