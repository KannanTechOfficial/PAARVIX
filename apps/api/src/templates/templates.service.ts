/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TemplateDashboard {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
}

const TEMPLATES: Record<string, TemplateDashboard[]> = {
  college: [
    {
      slug: 'student-portfolio',
      title: 'Student Portfolio',
      description:
        'Student record with biometric feed, attendance log, timetable, grades, and internals.',
      category: 'Education',
      tags: ['Education', 'Student', 'Attendance', 'Grades'],
    },
    {
      slug: 'college-analytics',
      title: 'College & Department Analytics',
      description:
        'Executive and HOD view of department attendance, pass percentage, grades, and defaulters.',
      category: 'Education',
      tags: ['Education', 'Departments', 'Defaulters', 'Analytics'],
    },
  ],
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private dashboardsFor(key: string): TemplateDashboard[] {
    const dashboards = TEMPLATES[key];
    if (!dashboards) {
      throw new NotFoundException('Unknown template');
    }
    return dashboards;
  }

  private assertAdmin(role: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can change templates');
    }
  }

  /** Creates the template's dashboards. Safe to repeat. */
  async apply(key: string, datasourceId: string, user: { id: string; role: string }) {
    this.assertAdmin(user.role);
    const datasource = datasourceId
      ? await this.prisma.datasource.findUnique({ where: { id: datasourceId } })
      : null;
    if (!datasource) {
      throw new BadRequestException('Choose a connected data source');
    }
    for (const { slug, title, description, category, tags } of this.dashboardsFor(key)) {
      await this.prisma.dashboard.upsert({
        where: { slug },
        update: { config: { category, tags, template: key, datasourceId } },
        create: {
          slug,
          title,
          description,
          isPublic: false,
          createdBy: user.id,
          config: { category, tags, template: key, datasourceId },
        },
      });
    }
    return { applied: key };
  }

  /** Removes the template's dashboards, returning the workspace to empty. */
  async remove(key: string, user: { role: string }) {
    this.assertAdmin(user.role);
    const slugs = this.dashboardsFor(key).map((d) => d.slug);
    await this.prisma.dashboard.deleteMany({ where: { slug: { in: slugs } } });
    return { removed: key };
  }
}
