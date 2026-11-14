/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Module } from '@nestjs/common';
import { DatasourcesModule } from '../datasources/datasources.module';
import { QueriesController } from './queries.controller';
import { QueriesService } from './queries.service';

@Module({
  imports: [DatasourcesModule],
  controllers: [QueriesController],
  providers: [QueriesService],
})
export class QueriesModule {}
