/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../access/permissions.guard';
import { type AuthUser, CurrentUser } from '../access/auth-user';
import { QueriesService, type RunInput, type SaveInput } from './queries.service';

/** Ad hoc and saved queries. Viewers have no datasources:query, so none of this is open to them. */
@Controller('queries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QueriesController {
  constructor(private readonly queries: QueriesService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('datasources:query')
  run(@Body() body: RunInput, @CurrentUser() user: AuthUser) {
    return this.queries.run(body, user);
  }

  @Get('history')
  @RequirePermissions('datasources:query')
  history(@CurrentUser() user: AuthUser) {
    return this.queries.history(user);
  }

  @Delete('history')
  @RequirePermissions('datasources:query')
  clearHistory(@CurrentUser() user: AuthUser) {
    return this.queries.clearHistory(user);
  }

  @Get()
  @RequirePermissions('datasources:query')
  list(@CurrentUser() user: AuthUser) {
    return this.queries.list(user);
  }

  @Post()
  @RequirePermissions('datasources:query', 'queries:write')
  create(@Body() body: SaveInput, @CurrentUser() user: AuthUser) {
    return this.queries.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions('datasources:query', 'queries:write')
  update(@Param('id') id: string, @Body() body: SaveInput, @CurrentUser() user: AuthUser) {
    return this.queries.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('queries:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.queries.remove(id, user);
  }
}
