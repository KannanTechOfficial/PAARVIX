/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatasourcesService } from '../datasources/datasources.service';
import { toSecurityContext } from '../datasources/security-context';
import { CollegeAnalytics, StudentProfile } from './college.types';

const ANALYTICS_SQL = 'SELECT data FROM paarvix_college_analytics LIMIT 1';
const STUDENT_BY_REG_SQL = 'SELECT data FROM paarvix_students WHERE reg_no = $1';
const STUDENT_BY_MAIL_SQL = 'SELECT data FROM paarvix_students WHERE official_mail = $1';

type CollegeUser = { id: string; email: string; role: string };

/** All college data comes from the data source bound when the template was applied. */
@Injectable()
export class CollegeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datasources: DatasourcesService,
  ) {}

  private async fetchOne<T>(user: CollegeUser, slug: string, sql: string, values: unknown[] = []): Promise<T> {
    const dashboard = await this.prisma.dashboard.findUnique({ where: { slug } });
    const datasourceId = (dashboard?.config as { datasourceId?: string } | null)?.datasourceId;
    if (!datasourceId) {
      throw new NotFoundException('Apply the College template with a data source first');
    }
    const { rows } = await this.datasources.query(datasourceId, sql, values, toSecurityContext(user));
    if (rows.length === 0) {
      throw new NotFoundException('No data found in the connected data source');
    }
    return rows[0].data as T;
  }

  /** Viewers get only their own record, matched by login email. */
  async getStudentPortfolio(user: CollegeUser, regNo?: string): Promise<StudentProfile> {
    const staff = user.role === 'ADMIN' || user.role === 'EDITOR';
    if (regNo && !staff) {
      throw new ForbiddenException('You can only view your own record');
    }
    return regNo
      ? this.fetchOne(user, 'student-portfolio', STUDENT_BY_REG_SQL, [regNo])
      : this.fetchOne(user, 'student-portfolio', STUDENT_BY_MAIL_SQL, [user.email]);
  }

  async getCollegeAnalytics(user: CollegeUser): Promise<CollegeAnalytics> {
    if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
      throw new ForbiddenException('You do not have permission to view college analytics');
    }
    return this.fetchOne(user, 'college-analytics', ANALYTICS_SQL);
  }
}
