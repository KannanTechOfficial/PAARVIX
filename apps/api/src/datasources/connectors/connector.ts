/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import type { QueryResult, QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';

/** A stored data source with secrets already decrypted. Never log or return it. */
export interface LoadedDatasource {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface Connector {
  type: 'postgres' | 'mysql' | 'excel' | 'gsheet';
  capabilities: { supportsRawSql: boolean; supportsWrite: false };
  /** Config keys that hold secrets. The service stores each as `encrypted<Key>` and never returns it. Values must be strings. */
  secretFields: string[];
  /** Checks required fields and returns the config to store. Plaintext secrets stay in it; the service encrypts them. */
  validateConfig(raw: unknown): Record<string, unknown>;
  testConnection(ds: LoadedDatasource): Promise<void>;
  discoverSchema(ds: LoadedDatasource): Promise<TableSchema[]>;
  query(ds: LoadedDatasource, spec: QuerySpec, ctx: SecurityContext): Promise<QueryResult>;
  runSql?(ds: LoadedDatasource, sql: string, values: unknown[], ctx: SecurityContext): Promise<QueryResult>;
}
