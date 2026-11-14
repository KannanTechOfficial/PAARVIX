/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../access/permissions.guard';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get()
  @RequirePermissions('dashboards:read')
  findAll() {
    return this.dashboardsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('dashboards:read')
  findOne(@Param('id') id: string) {
    return this.dashboardsService.findById(id);
  }

  @Post()
  @RequirePermissions('dashboards:write')
  create(@Body() body: { title: string; description?: string; slug: string; config?: object }, @Req() req: FastifyRequest) {
    const user = (req as any).user as { id: string };
    return this.dashboardsService.create({ ...body, createdBy: user.id });
  }

  @Put(':id')
  @RequirePermissions('dashboards:write')
  update(@Param('id') id: string, @Body() body: { title?: string; description?: string; config?: object }) {
    return this.dashboardsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('dashboards:delete')
  remove(@Param('id') id: string) {
    return this.dashboardsService.remove(id);
  }
}
