/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CollegeService } from './college.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AnyUser, PermissionsGuard, RequirePermissions } from '../access/permissions.guard';

@Controller('college')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CollegeController {
  constructor(private readonly collegeService: CollegeService) {}

  @Get('student/:regNo')
  @RequirePermissions('college:students')
  byRegNo(@Param('regNo') regNo: string, @Req() req: FastifyRequest) {
    return this.collegeService.getStudentPortfolio((req as any).user, regNo);
  }

  /** Every user may see their own record, matched by login email. */
  @Get('student')
  @AnyUser()
  own(@Req() req: FastifyRequest) {
    return this.collegeService.getStudentPortfolio((req as any).user);
  }

  @Get('analytics')
  @RequirePermissions('college:analytics')
  analytics(@Req() req: FastifyRequest) {
    return this.collegeService.getCollegeAnalytics((req as any).user);
  }
}
