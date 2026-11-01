/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private readonly tokenKey = 'pvx_access_token';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');

  constructor() {
    const saved = localStorage.getItem(this.tokenKey);
    if (saved) {
      this._token.set(saved);
    }
  }

  get token(): string | null {
    return this._token();
  }

  checkSetupRequired() {
    return this.http.get<{ setupRequired: boolean }>(`${this.apiUrl}/status`);
  }

  setup(data: { email: string; name: string; password: string; language?: string }) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/setup`, data).pipe(
      tap((res) => this.handleAuth(res)),
    );
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => this.handleAuth(res)),
    );
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe();
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(this.tokenKey);
    this.router.navigate(['/login']);
  }

  private handleAuth(res: AuthResponse) {
    this._token.set(res.accessToken);
    this._user.set(res.user);
    localStorage.setItem(this.tokenKey, res.accessToken);
  }
}

