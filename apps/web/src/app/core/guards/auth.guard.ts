/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, safeReturnUrl } from '../services/auth.service';

/** Signed-in pages. Checks the session with the server (renewing it if needed), then remembers where to return. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureUser().pipe(
    map((user) => {
      if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: safeReturnUrl(state.url) } });
      // Someone limited to one dashboard is always taken back to it. The API refuses everything else too.
      // Their own account page stays open to them, so they can sign out a lost device.
      if (user.locked && user.homeDashboardId && !state.url.startsWith(`/d/${user.homeDashboardId}`) && !state.url.startsWith('/account')) {
        return router.createUrlTree(['/d', user.homeDashboardId]);
      }
      return true;
    }),
  );
};

/** "/home": the person's home dashboard when one is set, otherwise the dashboard list. */
export const homeRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureUser().pipe(
    map((user) => (user?.homeDashboardId ? router.createUrlTree(['/d', user.homeDashboardId]) : router.createUrlTree(['/dashboards']))),
  );
};

/** The login page: a signed-in person goes straight on; a fresh install goes to setup. */
export const loginGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Google returns here with the token in the fragment; let the page take it.
  if (route.fragment?.startsWith('google=')) return true;
  return auth.ensureUser().pipe(
    map((user) => (user ? router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl'))) : true)),
  );
};

/** The setup page is only for an install with no users yet. */
export const setupGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.checkSetupRequired().pipe(map((s) => (s.setupRequired ? true : router.createUrlTree(['/login']))));
};
