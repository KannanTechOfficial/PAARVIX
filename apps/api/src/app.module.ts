/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './auth/sessions.module';
import { LicenseModule } from './license/license.module';
import { ExtensionsModule } from './extensions/extensions.module';
import { UsersModule } from './users/users.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DatasourcesModule } from './datasources/datasources.module';
import { SettingsModule } from './settings/settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { CollegeModule } from './college/college.module';
import { TemplatesModule } from './templates/templates.module';
import { AccessModule } from './access/access.module';
import { QueriesModule } from './queries/queries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    LicenseModule,
    ExtensionsModule,
    AccessModule,
    SessionsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DashboardsModule,
    DatasourcesModule,
    SettingsModule,
    CollegeModule,
    TemplatesModule,
    QueriesModule,
  ],
})
export class AppModule {
  /** Adds optional modules (Paarvix Pro) found at startup; with none, this is plain Community. */
  static withOptional(optional: DynamicModule[]): DynamicModule {
    return { module: AppModule, imports: optional };
  }
}
