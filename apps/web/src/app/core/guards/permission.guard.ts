/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Hides a page from users who lack the permission. The API still enforces it. */
export function permissionGuard(permission: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.ensureUser().pipe(
      map((user) => {
        if (!user) return router.createUrlTree(['/login']);
        return auth.can(permission) ? true : router.createUrlTree(['/dashboards']);
      }),
    );
  };
}
