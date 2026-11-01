/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Module } from '@nestjs/common';
import { ConnectorRegistry } from './connectors/connector-registry';
import { MysqlConnector } from './connectors/mysql.connector';
import { PostgresConnector } from './connectors/postgres.connector';
import { DatasourcesController } from './datasources.controller';
import { DatasourcesService } from './datasources.service';
import { TableStore } from './import/table-store';
import { SheetSyncService } from './sheet-sync.service';

@Module({
  controllers: [DatasourcesController],
  providers: [DatasourcesService, ConnectorRegistry, PostgresConnector, MysqlConnector, TableStore, SheetSyncService],
  exports: [DatasourcesService],
})
export class DatasourcesModule {}
