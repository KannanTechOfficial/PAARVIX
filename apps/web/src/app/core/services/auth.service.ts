/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name: string;
  language: string;
  department: string | null;
  roleId: string;
  role: string;
  roleName: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Only same-app paths, so a crafted ?returnUrl= can never send someone to another site. */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/dashboards';
  if (value.startsWith('/login') || value.startsWith('/setup')) return '/dashboards';
  return value;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private loadingUser: Observable<User | null> | null = null;
  private renewing: Observable<string | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isSuperAdmin = computed(() => !!this._user()?.isSuperAdmin);

  /**
   * The access token lives in memory only, so a script injected into the page cannot read it
   * from storage. A reload signs back in through the httpOnly refresh cookie in ensureUser.
   */
  constructor() {
    try {
      localStorage.removeItem('pvx_access_token'); // left by older versions
    } catch {
      /* storage blocked: nothing to clean */
    }
  }

  get token(): string | null {
    return this._token();
  }

  /** The API decides; this only chooses what to show. */
  can(permission: string): boolean {
    const u = this._user();
    return !!u && (u.isSuperAdmin || u.permissions.includes(permission));
  }

  /**
   * Renews the access token from the httpOnly refresh cookie. Many failing requests share
   * one renewal, so they do not race each other. Resolves to null when the session is over.
   */
  renewToken(): Observable<string | null> {
    this.renewing ??= this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}).pipe(
      tap((res) => this.handleAuth(res)),
      map((res) => res.accessToken),
      catchError(() => of(null)),
      finalize(() => (this.renewing = null)),
      shareReplay(1),
    );
    return this.renewing;
  }

  /**
   * Loads the signed-in user once per page load. An expired token is renewed first,
   * so a returning visitor is not thrown out. Resolves to null when signed out.
   */
  ensureUser(): Observable<User | null> {
    if (this._user()) return of(this._user());
    // No token in memory after a reload: renewToken() below restores it from the cookie.
    this.loadingUser ??= (this._token() ? this.fetchMe() : of(null)).pipe(
      switchMap((u) => (u ? of(u) : this.renewToken().pipe(switchMap((t) => (t ? this.fetchMe() : of(null)))))),
      tap((u) => {
        if (u) this._user.set(u);
        else this.clearSession();
      }),
      finalize(() => (this.loadingUser = null)),
      shareReplay(1),
    );
    return this.loadingUser;
  }

  private fetchMe(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(catchError(() => of(null)));
  }

  /** Re-reads role and permissions, e.g. after an admin edits the current user's role. */
  reloadUser(): Observable<User | null> {
    this._user.set(null);
    return this.ensureUser();
  }

  checkSetupRequired() {
    return this.http.get<{ setupRequired: boolean; googleEnabled?: boolean }>(`${this.apiUrl}/status`);
  }

  /** Stores a token the API issued after Google sign-in; the profile loads on the next ensureUser. */
  acceptToken(token: string) {
    this._token.set(token);
    this._user.set(null);
  }

  setup(data: { email: string; name: string; password: string; language?: string }) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/setup`, data).pipe(
      tap((res) => this.handleAuth(res)),
    );
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email: email.trim(), password }).pipe(
      tap((res) => this.handleAuth(res)),
    );
  }

  /** Forgets the session in this tab without calling the API. */
  clearSession() {
    this._token.set(null);
    this._user.set(null);
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({ error: () => undefined });
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Session ended by the server: back to login, remembering where the person was. */
  expire() {
    if (!this._token() && !this._user()) return;
    this.clearSession();
    const here = this.router.url;
    this.router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl(here), expired: 1 } });
  }

  private handleAuth(res: AuthResponse) {
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }
}
