/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { DashboardConfig, QueryResult } from '@paarvix/shared';

export interface DashboardItem {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  /** Set on the built-in college screens, which have their own pages. */
  template: string | null;
  config: DashboardConfig | null;
  version: number;
  updatedAt: string;
  creator: { id: string; name: string };
  roleIds?: string[];
  canEdit: boolean;
}

export interface PanelResult extends QueryResult { durationMs: number; ranAt: string }

/** Where a dashboard opens: template screens keep their own routes. */
export function dashboardRoute(d: Pick<DashboardItem, 'id' | 'slug' | 'template'>): string {
  if (d.slug === 'student-portfolio') return '/dashboards/student-portfolio';
  if (d.slug === 'college-analytics') return '/dashboards/college-analytics';
  return `/d/${d.id}`;
}

@Injectable({ providedIn: 'root' })
export class DashboardsApiService {
  private readonly http = inject(HttpClient);

  /** Preview: a role id, or "user:<id>" for one person (their row rules included). */
  private params(as?: string | null) {
    if (!as) return undefined;
    return as.startsWith('user:') ? new HttpParams().set('asUser', as.slice(5)) : new HttpParams().set('asRole', as);
  }

  list(asRole?: string | null) { return this.http.get<DashboardItem[]>('/api/dashboards', { params: this.params(asRole) }); }
  get(id: string, asRole?: string | null) {
    return this.http.get<DashboardItem>(`/api/dashboards/${encodeURIComponent(id)}`, { params: this.params(asRole) });
  }
  create(body: { title: string; description?: string; roleIds?: string[] }) { return this.http.post<DashboardItem>('/api/dashboards', body); }
  save(id: string, body: { title?: string; description?: string; config?: DashboardConfig; roleIds?: string[]; version: number }) {
    return this.http.put<DashboardItem>(`/api/dashboards/${encodeURIComponent(id)}`, body);
  }
  remove(id: string) { return this.http.delete(`/api/dashboards/${encodeURIComponent(id)}`); }
  panelData(id: string, panelId: string, asRole?: string | null) {
    return this.http.post<PanelResult>(`/api/dashboards/${encodeURIComponent(id)}/panels/${encodeURIComponent(panelId)}/data`, {}, { params: this.params(asRole) });
  }
  setRoleHome(roleId: string, body: { homeDashboardId: string | null; lockToHome: boolean }) {
    return this.http.patch(`/api/roles/${encodeURIComponent(roleId)}/home`, body);
  }
}
