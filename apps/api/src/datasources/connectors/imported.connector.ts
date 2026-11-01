/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import type { QueryResult, QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';
import { TableStore } from '../import/table-store';
import { compileQuery } from '../query-compiler';
import type { Connector, LoadedDatasource } from './connector';
import { parseSheetId, validateServiceAccount } from './gsheet.client';

const MIN_SYNC_MINUTES = 15;
const MAX_SYNC_MINUTES = 7 * 24 * 60;

/** `link` becomes `spreadsheetId`, so no query string or fragment of the pasted link is kept. */
function gsheetConfig(raw: unknown): Record<string, unknown> {
  const { link, serviceAccount, syncMinutes } = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { spreadsheetId: parseSheetId(link as string) };
  if (serviceAccount !== undefined && serviceAccount !== '') out.serviceAccount = validateServiceAccount(serviceAccount);
  if (syncMinutes !== undefined && syncMinutes !== null && syncMinutes !== 0) {
    if (!Number.isInteger(syncMinutes) || (syncMinutes as number) < MIN_SYNC_MINUTES || (syncMinutes as number) > MAX_SYNC_MINUTES) {
      throw new BadRequestException(`Sync interval must be a whole number of minutes between ${MIN_SYNC_MINUTES} and ${MAX_SYNC_MINUTES}`);
    }
    out.syncMinutes = syncMinutes;
  }
  return out;
}

/** Spreadsheet sources (uploaded Excel, Google Sheets). Their rows live in paarvix_data, so there is no host config and no raw SQL. */
export function importedConnector(store: TableStore, type: 'excel' | 'gsheet'): Connector {
  return {
    type,
    capabilities: { supportsRawSql: false, supportsWrite: false },
    secretFields: type === 'gsheet' ? ['serviceAccount'] : [],

    validateConfig(raw: unknown) {
      // Excel sources are created by uploading a file.
      if (type === 'excel') throw new BadRequestException('Create an Excel source by uploading a file');
      return gsheetConfig(raw);
    },

    async testConnection(ds: LoadedDatasource) {
      // Reports the last sync honestly without importing or calling Google.
      if (typeof ds.config.lastSyncError === 'string') throw new Error(`Last sync failed: ${ds.config.lastSyncError}`);
      if (!(await store.tables(ds.id)).length) throw new Error('No data has been imported yet');
    },

    discoverSchema: (ds: LoadedDatasource): Promise<TableSchema[]> => store.tables(ds.id),

    async query(ds: LoadedDatasource, spec: QuerySpec, ctx: SecurityContext): Promise<QueryResult> {
      const table = (await store.tables(ds.id)).find((t) => t.name === spec.table);
      if (!table) throw new BadRequestException('table no longer exists');
      return store.run(compileQuery(spec, table, 'postgres', ctx));
    },
  };
}
