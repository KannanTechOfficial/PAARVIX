/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Routes } from '@angular/router';
import { authGuard, loginGuard, setupGuard } from './core/guards/auth.guard';
import { ShellComponent } from './core/layout/shell/shell.component';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboards',
        loadComponent: () =>
          import('./features/dashboards/dashboards.component').then(
            (m) => m.DashboardsComponent,
          ),
      },
      {
        path: 'dashboards/student-portfolio',
        loadComponent: () =>
          import('./features/college/student-portfolio/student-portfolio.component').then(
            (m) => m.StudentPortfolioComponent,
          ),
      },
      {
        path: 'dashboards/college-analytics',
        loadComponent: () =>
          import('./features/college/college-analytics/college-analytics.component').then(
            (m) => m.CollegeAnalyticsComponent,
          ),
      },
      {
        path: 'datasources',
        canActivate: [permissionGuard('datasources:read')],
        loadComponent: () =>
          import('./features/datasources/datasources.component').then(
            (m) => m.DatasourcesComponent,
          ),
      },
      {
        path: 'queries',
        canActivate: [permissionGuard('datasources:query')],
        loadComponent: () =>
          import('./features/queries/queries.component').then(
            (m) => m.QueriesComponent,
          ),
      },
      {
        path: 'templates',
        canActivate: [permissionGuard('templates:apply')],
        loadComponent: () =>
          import('./features/templates/templates.component').then(
            (m) => m.TemplatesComponent,
          ),
      },
      { path: 'settings', redirectTo: 'admin/settings', pathMatch: 'full' },
      {
        path: 'admin/users',
        canActivate: [permissionGuard('users:read')],
        loadComponent: () => import('./features/admin/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'admin/roles',
        canActivate: [permissionGuard('roles:read')],
        loadComponent: () => import('./features/admin/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'admin/access',
        canActivate: [permissionGuard('datasources:access')],
        loadComponent: () => import('./features/admin/access.component').then((m) => m.AccessComponent),
      },
      {
        path: 'admin/plugins',
        canActivate: [permissionGuard('plugins:read')],
        loadComponent: () => import('./features/admin/plugins.component').then((m) => m.PluginsComponent),
      },
      {
        path: 'admin/settings',
        canActivate: [permissionGuard('settings:write')],
        loadComponent: () => import('./features/admin/settings.component').then((m) => m.AdminSettingsComponent),
      },
      { path: 'admin', redirectTo: 'admin/users', pathMatch: 'full' },
      { path: '', redirectTo: 'dashboards', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
