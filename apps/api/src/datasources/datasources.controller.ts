/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { toSecurityContext } from './security-context';
import type { QuerySpec } from '@paarvix/shared';
import { JwtAuthGuard } from '../auth/auth.guard';

type AuthUser = { id: string; role: string };

function requireRole(req: FastifyRequest, ...roles: string[]): AuthUser {
  const user = (req as any).user as AuthUser;
  if (!roles.includes(user.role)) {
    throw new ForbiddenException('You do not have permission for this action');
  }
  return user;
}

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
@UseGuards(JwtAuthGuard)
export class DatasourcesController {
  constructor(
    private readonly datasourcesService: DatasourcesService,
    private readonly sheetSync: SheetSyncService,
  ) {}

  @Get()
  findAll(@Req() req: FastifyRequest) {
    requireRole(req, 'ADMIN', 'EDITOR');
    return this.datasourcesService.findAll();
  }

  @Post()
  create(
    @Body() body: { name: string; type: string; config: Record<string, unknown> },
    @Req() req: FastifyRequest,
  ) {
    const user = requireRole(req, 'ADMIN');
    return this.datasourcesService.create({ ...body, createdBy: user.id });
  }

  @Post('upload')
  upload(@Req() req: FastifyRequest) {
    const user = requireRole(req, 'ADMIN');
    return withUpload(req, true, (path, name) => this.datasourcesService.createFromUpload(name, path, user.id));
  }

  @Post(':id/upload')
  async replaceUpload(@Param('id') id: string, @Req() req: FastifyRequest) {
    requireRole(req, 'ADMIN');
    await this.datasourcesService.uploadTarget(id);
    return withUpload(req, false, (path) => this.datasourcesService.replaceUpload(id, path));
  }

  @Post(':id/sync')
  async sync(@Param('id') id: string, @Req() req: FastifyRequest) {
    requireRole(req, 'ADMIN');
    await this.sheetSync.sync(id);
    return { synced: id };
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: FastifyRequest) {
    requireRole(req, 'ADMIN');
    return this.datasourcesService.remove(id);
  }

  @Post(':id/test')
  testConnection(@Param('id') id: string, @Req() req: FastifyRequest) {
    requireRole(req, 'ADMIN');
    return this.datasourcesService.testConnection(id);
  }

  /** Raw SQL is never available to Viewers. */
  @Post(':id/query')
  query(@Param('id') id: string, @Body() body: { sql: string }, @Req() req: FastifyRequest) {
    const user = requireRole(req, 'ADMIN', 'EDITOR');
    return this.datasourcesService.query(id, body.sql, [], toSecurityContext(user));
  }

  @Get(':id/schema')
  schema(@Param('id') id: string, @Req() req: FastifyRequest) {
    const user = requireRole(req, 'ADMIN', 'EDITOR');
    return this.datasourcesService.schema(id, toSecurityContext(user));
  }

  @Post(':id/data')
  data(@Param('id') id: string, @Body() spec: QuerySpec, @Req() req: FastifyRequest) {
    const user = requireRole(req, 'ADMIN', 'EDITOR');
    return this.datasourcesService.data(id, spec, toSecurityContext(user));
  }
}
