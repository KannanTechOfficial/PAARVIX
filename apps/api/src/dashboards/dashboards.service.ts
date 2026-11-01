/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.dashboard.findMany({
      include: { creator: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    const dashboard = await this.prisma.dashboard.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${id} not found`);
    }
    return dashboard;
  }

  async create(data: { title: string; description?: string; slug: string; config?: object; createdBy: string }) {
    return this.prisma.dashboard.create({ data });
  }

  async update(id: string, data: { title?: string; description?: string; config?: object }) {
    return this.prisma.dashboard.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.dashboard.delete({ where: { id } });
  }
}
