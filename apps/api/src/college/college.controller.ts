/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CollegeService } from './college.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('college')
@UseGuards(JwtAuthGuard)
export class CollegeController {
  constructor(private readonly collegeService: CollegeService) {}

  @Get('student/:regNo')
  byRegNo(@Param('regNo') regNo: string, @Req() req: FastifyRequest) {
    return this.collegeService.getStudentPortfolio((req as any).user, regNo);
  }

  @Get('student')
  own(@Req() req: FastifyRequest) {
    return this.collegeService.getStudentPortfolio((req as any).user);
  }

  @Get('analytics')
  analytics(@Req() req: FastifyRequest) {
    return this.collegeService.getCollegeAnalytics((req as any).user);
  }
}
