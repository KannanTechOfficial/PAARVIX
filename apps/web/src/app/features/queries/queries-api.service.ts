/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { QueryResult, QuerySpec, TableSchema } from '@paarvix/shared';

export type QueryKind = 'builder' | 'sql';

export interface SourceItem { id: string; name: string; type: string }

export interface RunResult extends QueryResult { durationMs: number }

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  kind: QueryKind;
  datasourceId: string;
  querySpec: QuerySpec | Record<string, never>;
  sql: string | null;
  visibility: 'private' | 'shared';
  createdBy: string;
  updatedAt: string;
  datasource: { name: string; type: string };
  creator: { name: string };
}

export interface HistoryItem {
  id: string;
  datasourceId: string;
  kind: QueryKind;
  querySpec: QuerySpec | null;
  sql: string | null;
  rowCount: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
  datasource: { name: string };
}

export interface RunBody { datasourceId: string; kind: QueryKind; spec?: QuerySpec; sql?: string }

/** Sources whose connector runs SQL. Spreadsheets stay builder-only until DuckDB arrives. */
export const SQL_SOURCES = new Set(['postgres', 'mysql']);

@Injectable({ providedIn: 'root' })
export class QueriesApiService {
  private readonly http = inject(HttpClient);

  sources() { return this.http.get<SourceItem[]>('/api/datasources'); }
  schema(id: string) { return this.http.get<TableSchema[]>(`/api/datasources/${encodeURIComponent(id)}/schema`); }
  run(body: RunBody) { return this.http.post<RunResult>('/api/queries/run', body); }
  saved() { return this.http.get<SavedQuery[]>('/api/queries'); }
  save(body: RunBody & { name: string; description: string; visibility: 'private' | 'shared' }) { return this.http.post<SavedQuery>('/api/queries', body); }
  update(id: string, body: RunBody & { name: string; description: string; visibility: 'private' | 'shared' }) {
    return this.http.patch<SavedQuery>(`/api/queries/${encodeURIComponent(id)}`, body);
  }
  remove(id: string) { return this.http.delete(`/api/queries/${encodeURIComponent(id)}`); }
  history() { return this.http.get<HistoryItem[]>('/api/queries/history'); }
  clearHistory() { return this.http.delete('/api/queries/history'); }
}
