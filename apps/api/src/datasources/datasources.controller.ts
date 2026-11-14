/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Put,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { DatasourcesService } from './datasources.service';
import { SheetSyncService } from './sheet-sync.service';
import { type AuthUser, CurrentUser, toSecurityContext } from '../access/auth-user';
import { PermissionsGuard, RequirePermissions } from '../access/permissions.guard';
import { FeaturesService } from '../access/features.service';
import { ConnectorRegistry } from './connectors/connector-registry';
import type { QuerySpec } from '@paarvix/shared';
import { JwtAuthGuard } from '../auth/auth.guard';

const TOO_BIG = 'File is larger than 50 MB';
const MAX_NAME = 100;

/**
 * Saves the multipart file to a private temp directory for the duration of `use`.
 * `name` must be sent before the file in the form, because the file is streamed and never buffered.
 */
async function withUpload<T>(req: FastifyRequest, needsName: boolean, use: (path: string, name: string) => Promise<T>): Promise<T> {
  let part;
  try {
    part = await (req as any).file();
  } catch {
    throw new BadRequestException('Please upload an .xlsx file');
  }
  if (!part) throw new BadRequestException('Please choose a file');
  try {
    const field = part.fields?.name;
    const name = typeof field?.value === 'string' ? field.value.trim() : '';
    if (needsName && (!name || name.length > MAX_NAME)) {
      throw new BadRequestException(name ? `Name must be ${MAX_NAME} characters or fewer` : 'Name is required');
    }
    if (!String(part.filename).toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Please upload an .xlsx file');

    const dir = await mkdtemp(join(tmpdir(), 'paarvix-upload-'));
    try {
      const path = join(dir, `${randomUUID()}.xlsx`);
      try {
        await pipeline(part.file, createWriteStream(path));
      } catch (e) {
        if ((e as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new BadRequestException(TOO_BIG);
        throw new BadRequestException('Could not read this file');
      }
      if (part.file.truncated) throw new BadRequestException(TOO_BIG);
      return await use(path, name);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } finally {
    part.file.resume(); // let an unread body drain so the connection is not left hanging
  }
}

@Controller('datasources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DatasourcesController {
  constructor(
    private readonly datasourcesService: DatasourcesService,
    private readonly sheetSync: SheetSyncService,
    private readonly registry: ConnectorRegistry,
    private readonly features: FeaturesService,
  ) {}

  @Get()
  @RequirePermissions('datasources:read')
  findAll(@CurrentUser() user: AuthUser) {
    return this.datasourcesService.findAll(user);
  }

  @Get('connectors')
  @RequirePermissions('plugins:read')
  connectors() {
    return this.registry.list();
  }

  @Get('access')
  @RequirePermissions('datasources:access')
  accessMatrix() {
    this.features.assertEnabled('datasources.access');
    return this.datasourcesService.accessMatrix();
  }

  @Get('rules')
  @RequirePermissions('datasources:access')
  rules() {
    this.features.assertEnabled('rows.rules');
    return this.datasourcesService.listRules();
  }

  @Post(':id/rules')
  @RequirePermissions('datasources:access')
  addRule(@Param('id') id: string, @Body() body: { roleId: string; column: string; attribute: string }) {
    this.features.assertEnabled('rows.rules');
    return this.datasourcesService.addRule(id, body);
  }

  @Delete('rules/:ruleId')
  @RequirePermissions('datasources:access')
  removeRule(@Param('ruleId') ruleId: string) {
    this.features.assertEnabled('rows.rules');
    return this.datasourcesService.removeRule(ruleId);
  }

  @Put(':id/access')
  @RequirePermissions('datasources:access')
  setAccess(@Param('id') id: string, @Body() body: { roleIds: string[] }) {
    this.features.assertEnabled('datasources.access');
    return this.datasourcesService.setAccess(id, body?.roleIds);
  }

  @Post()
  @RequirePermissions('datasources:write')
  create(@Body() body: { name: string; type: string; config: Record<string, unknown> }, @CurrentUser() user: AuthUser) {
    return this.datasourcesService.create({ ...body, createdBy: user.id });
  }

  @Post('upload')
  @RequirePermissions('datasources:write')
  upload(@Req() req: FastifyRequest, @CurrentUser() user: AuthUser) {
    return withUpload(req, true, (path, name) => this.datasourcesService.createFromUpload(name, path, user.id));
  }

  @Post(':id/upload')
  @RequirePermissions('datasources:write')
  async replaceUpload(@Param('id') id: string, @Req() req: FastifyRequest) {
    await this.datasourcesService.uploadTarget(id);
    return withUpload(req, false, (path) => this.datasourcesService.replaceUpload(id, path));
  }

  @Post(':id/sync')
  @RequirePermissions('datasources:write')
  async sync(@Param('id') id: string) {
    await this.sheetSync.sync(id);
    return { synced: id };
  }

  @Delete(':id')
  @RequirePermissions('datasources:write')
  remove(@Param('id') id: string) {
    return this.datasourcesService.remove(id);
  }

  @Post(':id/test')
  @RequirePermissions('datasources:write')
  testConnection(@Param('id') id: string) {
    return this.datasourcesService.testConnection(id);
  }

  /** Raw SQL needs datasources:query and a grant for the user's role on this source. */
  @Post(':id/query')
  @RequirePermissions('datasources:query')
  async query(@Param('id') id: string, @Body() body: { sql: string }, @CurrentUser() user: AuthUser) {
    await this.datasourcesService.assertCanUse(id, user);
    return this.datasourcesService.query(id, body.sql, [], toSecurityContext(user));
  }

  @Get(':id/schema')
  @RequirePermissions('datasources:read')
  async schema(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.datasourcesService.assertCanUse(id, user);
    return this.datasourcesService.schema(id, toSecurityContext(user));
  }

  @Post(':id/data')
  @RequirePermissions('datasources:query')
  async data(@Param('id') id: string, @Body() spec: QuerySpec, @CurrentUser() user: AuthUser) {
    await this.datasourcesService.assertCanUse(id, user);
    return this.datasourcesService.data(id, spec, toSecurityContext(user));
  }
}
