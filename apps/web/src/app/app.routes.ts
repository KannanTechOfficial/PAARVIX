/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './core/layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'setup',
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
        loadComponent: () =>
          import('./features/datasources/datasources.component').then(
            (m) => m.DatasourcesComponent,
          ),
      },
      {
        path: 'queries',
        loadComponent: () =>
          import('./features/queries/queries.component').then(
            (m) => m.QueriesComponent,
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./features/templates/templates.component').then(
            (m) => m.TemplatesComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      { path: '', redirectTo: 'dashboards', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
