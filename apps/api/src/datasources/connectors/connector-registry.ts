/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import type { Connector } from './connector';
import { importedConnector } from './imported.connector';
import { MysqlConnector } from './mysql.connector';
import { PostgresConnector } from './postgres.connector';
import { TableStore } from '../import/table-store';

@Injectable()
export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>();

  constructor(postgres: PostgresConnector, mysql: MysqlConnector, store: TableStore) {
    for (const c of [postgres, mysql, importedConnector(store, 'excel'), importedConnector(store, 'gsheet')]) {
      this.connectors.set(c.type, c);
    }
  }

  /** Every connector's secret keys. Never throws, so rows of an unknown type can still be listed and removed. */
  allSecretFields(): Set<string> {
    return new Set([...this.connectors.values()].flatMap((c) => c.secretFields));
  }

  get(type: string): Connector {
    const connector = this.connectors.get(type);
    if (!connector) throw new BadRequestException(`Datasource type ${String(type).slice(0, 32)} is not supported`);
    return connector;
  }
}
