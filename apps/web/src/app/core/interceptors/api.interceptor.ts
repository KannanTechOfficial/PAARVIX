/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Sign-in routes answer 401 for a wrong password; that must never trigger a renewal or a sign-out. */
const AUTH_ROUTES = ['/api/auth/login', '/api/auth/setup', '/api/auth/refresh', '/api/auth/status', '/api/auth/logout'];

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Adds the access token. On a 401 it renews the token once and repeats the request,
 * so the 15-minute token expiry is invisible. Only when renewal fails does the person go to login.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (AUTH_ROUTES.some((r) => req.url.startsWith(r))) return next(req);

  return next(withToken(req, auth.token)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !req.url.startsWith('/api/')) return throwError(() => err);
      return auth.renewToken().pipe(
        switchMap((token) => {
          if (!token) {
            auth.expire();
            return throwError(() => err);
          }
          return next(withToken(req, token));
        }),
      );
    }),
  );
};
