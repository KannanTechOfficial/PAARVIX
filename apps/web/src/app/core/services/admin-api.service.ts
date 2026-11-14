/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

export interface RoleRef { id: string; key: string; name: string }

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  language: string;
  department: string | null;
  homeDashboardId: string | null;
  attributes: Record<string, string>;
  createdAt: string;
  assignedRole: RoleRef | null;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  homeDashboardId: string | null;
  lockToHome: boolean;
}

export interface PermissionCatalog {
  groups: { id: string; label: string; permissions: { id: string; label: string }[] }[];
  features: { id: string; label: string; enabled: boolean }[];
}

export interface AccessMatrix {
  roles: { id: string; key: string; name: string; isSystem: boolean; alwaysAllowed: boolean; canQuery: boolean }[];
  sources: { id: string; name: string; type: string; roleIds: string[] }[];
}

export interface RowRule {
  id: string;
  datasourceId: string;
  roleId: string;
  column: string;
  attribute: string;
  datasource: { name: string };
  role: { name: string; key: string };
}

export interface ConnectorInfo { type: string; supportsRawSql: boolean; secretFields: string[] }

export interface ThemeTokens { primary: string; accent: string; warn: string; radius: number; density: 'comfortable' | 'compact' }
export interface OrgSettings { name: string; defaultLanguage: 'en' | 'ta' }
export interface AppSettings { org: OrgSettings; theme: ThemeTokens }

/** Turns an API error into the message the server wrote for people. */
export function errorText(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof HttpErrorResponse) {
    const m = err.error?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
    if (err.status === 0) return 'Cannot reach the server';
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  users() { return this.http.get<AdminUser[]>('/api/users'); }
  createUser(body: { name: string; email: string; password: string; roleId: string; language: string; department: string | null }) {
    return this.http.post<AdminUser>('/api/users', body);
  }
  updateUser(id: string, body: Partial<{ name: string; roleId: string; isActive: boolean; language: string; department: string | null; homeDashboardId: string | null; attributes: Record<string, string> }>) {
    return this.http.patch<AdminUser>(`/api/users/${encodeURIComponent(id)}`, body);
  }
  /** Signs a person out on every device they are signed in on. */
  revokeSessions(id: string) {
    return this.http.post<{ ended: number }>(`/api/users/${encodeURIComponent(id)}/sessions/revoke`, {});
  }

  setPassword(id: string, password: string) {
    return this.http.post(`/api/users/${encodeURIComponent(id)}/password`, { password });
  }

  roles() { return this.http.get<Role[]>('/api/roles'); }
  permissions() { return this.http.get<PermissionCatalog>('/api/roles/permissions'); }
  createRole(body: { name: string; description: string; permissions: string[] }) { return this.http.post<Role>('/api/roles', body); }
  updateRole(id: string, body: { name: string; description: string; permissions: string[] }) {
    return this.http.patch<Role>(`/api/roles/${encodeURIComponent(id)}`, body);
  }
  deleteRole(id: string) { return this.http.delete(`/api/roles/${encodeURIComponent(id)}`); }

  access() { return this.http.get<AccessMatrix>('/api/datasources/access'); }
  setAccess(id: string, roleIds: string[]) { return this.http.put(`/api/datasources/${encodeURIComponent(id)}/access`, { roleIds }); }

  rules() { return this.http.get<RowRule[]>('/api/datasources/rules'); }
  addRule(datasourceId: string, body: { roleId: string; column: string; attribute: string }) {
    return this.http.post(`/api/datasources/${encodeURIComponent(datasourceId)}/rules`, body);
  }
  removeRule(id: string) { return this.http.delete(`/api/datasources/rules/${encodeURIComponent(id)}`); }
  sourceColumns(id: string) { return this.http.get<{ name: string; columns: { name: string }[] }[]>(`/api/datasources/${encodeURIComponent(id)}/schema`); }

  connectors() { return this.http.get<ConnectorInfo[]>('/api/datasources/connectors'); }

  settings() { return this.http.get<AppSettings>('/api/settings'); }
  saveSettings(body: { org?: Partial<OrgSettings>; theme?: Partial<ThemeTokens> }) { return this.http.patch<AppSettings>('/api/settings', body); }
  resetTheme() { return this.http.post<AppSettings>('/api/settings/theme/reset', {}); }
}
