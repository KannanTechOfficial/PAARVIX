/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DatasourcesModule } from './datasources/datasources.module';
import { SettingsModule } from './settings/settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { CollegeModule } from './college/college.module';
import { TemplatesModule } from './templates/templates.module';
import { AccessModule } from './access/access.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    AccessModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DashboardsModule,
    DatasourcesModule,
    SettingsModule,
    CollegeModule,
    TemplatesModule,
  ],
})
export class AppModule {}
