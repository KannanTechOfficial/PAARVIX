/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

export type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type FilterOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'isNull';

export interface Filter {
  column: string;
  op: FilterOp;
  value?: unknown;
}

/** Required on every data path. `tenantId` is null until multi-tenancy (P3). */
export interface SecurityContext {
  userId: string;
  role: UserRole;
  tenantId: string | null;
  rowFilters: Filter[]; // always ANDed in; empty until RLS (P2 Pro)
}

export interface QuerySpec {
  table: string;
  columns?: string[];
  filters?: Filter[];
  groupBy?: string[];
  aggregates?: { fn: 'count' | 'sum' | 'avg' | 'min' | 'max'; column?: string; as: string }[];
  orderBy?: { column: string; dir: 'asc' | 'desc' }[];
  limit?: number;
}

export type ColumnType = 'number' | 'date' | 'boolean' | 'text';

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  storageName?: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  storageName?: string;
  rowCount?: number;
}

export interface QueryResult {
  fields: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}
