/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post(':key/apply')
  apply(
    @Param('key') key: string,
    @Body() body: { datasourceId: string },
    @Req() req: FastifyRequest,
  ) {
    return this.templatesService.apply(key, body?.datasourceId, (req as any).user);
  }

  @Delete(':key')
  remove(@Param('key') key: string, @Req() req: FastifyRequest) {
    return this.templatesService.remove(key, (req as any).user);
  }
}
