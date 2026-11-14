/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/**
 * Every permission, written resource:verb. The API checks these on each route;
 * the web app uses the same list to decide what to show.
 * Adding a permission here is the only step needed to make it grantable.
 */
export const PERMISSIONS = {
  'dashboards:read': 'View dashboards',
  'dashboards:write': 'Create and edit dashboards',
  'dashboards:delete': 'Delete dashboards',
  'templates:apply': 'Apply and remove templates',
  'datasources:read': 'See data sources and their tables',
  'datasources:query': 'Run queries and preview rows',
  'datasources:write': 'Add, update and remove data sources',
  'datasources:access': 'Choose which roles can use each data source',
  'queries:write': 'Save and share queries',
  'college:analytics': 'View college analytics',
  'college:students': 'View any student record',
  'users:read': 'See users',
  'users:write': 'Add, edit and deactivate users',
  'roles:read': 'See roles and permissions',
  'roles:write': 'Create and edit roles',
  'settings:write': 'Change organisation settings',
  'theme:write': 'Change the theme',
  'plugins:read': 'See installed connectors and plugins',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Groups for the role editor, in display order. */
export const PERMISSION_GROUPS: { id: string; label: string; permissions: Permission[] }[] = [
  { id: 'workspace', label: 'Dashboards', permissions: ['dashboards:read', 'dashboards:write', 'dashboards:delete', 'templates:apply'] },
  { id: 'data', label: 'Data', permissions: ['datasources:read', 'datasources:query', 'queries:write', 'datasources:write', 'datasources:access'] },
  { id: 'college', label: 'College', permissions: ['college:analytics', 'college:students'] },
  { id: 'admin', label: 'Administration', permissions: ['users:read', 'users:write', 'roles:read', 'roles:write', 'settings:write', 'theme:write', 'plugins:read'] },
];

export const SUPER_ADMIN = 'super_admin';

export interface BuiltInRole {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}

/** Seeded on every start. Built-in roles cannot be edited or deleted; copy one to customise it. */
export const BUILT_IN_ROLES: BuiltInRole[] = [
  {
    key: SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Everything, always. Cannot be changed. At least one must exist.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Runs the workspace: users, data sources, settings. Cannot create Super Admins.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'editor',
    name: 'Editor',
    description: 'Builds dashboards and queries the data sources they are given.',
    permissions: ['dashboards:read', 'dashboards:write', 'dashboards:delete', 'datasources:read', 'datasources:query', 'queries:write', 'college:analytics', 'college:students'],
  },
  {
    key: 'analyst',
    name: 'Analyst',
    description: 'Explores and queries the data sources they are given. Does not edit dashboards.',
    permissions: ['dashboards:read', 'datasources:read', 'datasources:query', 'queries:write', 'college:analytics'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Views dashboards. Sees only their own student record.',
    permissions: ['dashboards:read'],
  },
];

/** Maps the old fixed role column to a built-in role. */
export const LEGACY_ROLE_MAP: Record<string, string> = { ADMIN: 'admin', EDITOR: 'editor', VIEWER: 'viewer' };

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/**
 * Features that may become Pro. Founder decision, 2026-11-14: everything is open now,
 * and the free/Pro split is decided before the first public release, so nothing that
 * has shipped free is taken away later. The licence system (P2) will read this list.
 */
export const GATED_FEATURES = {
  'roles.custom': 'Create and edit custom roles',
  'datasources.access': 'Per-data-source access by role',
  'theme.custom': 'Custom theme',
  'rows.rules': 'Row rules: each person sees only their own rows',
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;
