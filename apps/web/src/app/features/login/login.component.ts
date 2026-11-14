/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService, safeReturnUrl } from '../../core/services/auth.service';

const GOOGLE_ERRORS = ['google_state', 'google_denied', 'google_exchange', 'google_unverified', 'google_not_registered', 'google_off'];

@Component({
  selector: 'pvx-login',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="pvx-login-page">
      <div class="pvx-login-card">
        <div class="pvx-login-header">
          <h1>Paarvix</h1>
          <p>{{ 'app.tagline' | translate }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="pvx-login-form">
          <div class="pvx-field">
            <label>{{ 'auth.email' | translate }}</label>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              autocomplete="email"
              placeholder="you@example.com" />
          </div>
          <div class="pvx-field">
            <label>{{ 'auth.password' | translate }}</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              autocomplete="current-password"
              placeholder="••••••••••••" />
          </div>

          @if (error()) {
            <div class="pvx-error">{{ error() }}</div>
          }

          <button type="submit" class="pvx-btn-primary" [disabled]="loading()">
            {{ loading() ? ('common.loading' | translate) : ('auth.signIn' | translate) }}
          </button>
        </form>

        @if (googleEnabled()) {
          <div class="pvx-or"><span>{{ 'auth.or' | translate }}</span></div>
          <a class="pvx-google" href="/api/auth/google">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>
            {{ 'auth.google' | translate }}
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    .pvx-login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--pvx-bg);
    }

    .pvx-login-card {
      width: 100%;
      max-width: 420px;
      padding: 36px;
      background: var(--pvx-bg-card);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border: 1px solid var(--pvx-border);
    }

    .pvx-login-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .pvx-login-logo { font-size: 48px; }

    h1 {
      font-family: 'Poppins', sans-serif;
      color: var(--pvx-primary);
      margin-top: 8px;
      font-size: 26px;
    }

    p { color: var(--pvx-text-muted); margin-top: 4px; font-size: 14px; }

    .pvx-login-form { display: flex; flex-direction: column; gap: 16px; }

    .pvx-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pvx-field label {
      font-size: 13px;
      font-weight: 600;
      color: var(--pvx-text);
    }

    .pvx-field input {
      padding: 10px 14px;
      border: 1px solid var(--pvx-border);
      border-radius: 8px;
      font-size: 14px;
      background: var(--pvx-bg);
      color: var(--pvx-text);
      transition: border-color 0.2s, outline 0.2s;
      &:focus { outline: 2px solid var(--pvx-primary); border-color: transparent; }
    }

    .pvx-btn-primary {
      padding: 12px;
      background: var(--pvx-primary);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 150ms;
      margin-top: 8px;
      &:hover { opacity: 0.9; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .pvx-error {
      padding: 10px 14px;
      background: #FEE2E2;
      color: #DC2626;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }

    .pvx-or { display: flex; align-items: center; gap: 12px; margin: 20px 0 16px; color: var(--pvx-text-muted); font-size: 13px; }
    .pvx-or::before, .pvx-or::after { content: ''; flex: 1; border-top: 1px solid var(--pvx-border); }
    .pvx-google { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; border: 1px solid var(--pvx-border-strong);
      border-radius: 8px; background: var(--pvx-bg-card); color: var(--pvx-text); font-weight: 600; font-size: 14px; text-decoration: none; }
    .pvx-google:hover { background: var(--pvx-bg-sunken); text-decoration: none; }
    .pvx-login-footer {
      text-align: center;
      margin-top: 24px;
      font-size: 13px;
      color: var(--pvx-text-muted);
    }

    .pvx-setup-link {
      color: var(--pvx-primary);
      font-weight: 600;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  `],
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  googleEnabled = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  ngOnInit() {
    // Google sends the user back with the token in the fragment. Take it, then remove it from the address bar.
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get('google');
    if (token) {
      history.replaceState(null, '', location.pathname);
      this.auth.acceptToken(token);
      this.auth.ensureUser().subscribe((u) => {
        if (u) this.router.navigateByUrl('/dashboards');
        else this.t.get('auth.errors.google_exchange').subscribe((text: string) => this.error.set(text));
      });
      return;
    }
    const code = new URLSearchParams(location.search).get('error');
    if (code && GOOGLE_ERRORS.includes(code)) {
      // get() waits for the language file; instant() would show the raw key on first load.
      this.t.get(`auth.errors.${code}`).subscribe((text: string) => this.error.set(text));
      history.replaceState(null, '', location.pathname);
    }
    if (this.route.snapshot.queryParamMap.get('expired')) {
      this.t.get('auth.expired').subscribe((text: string) => this.error.set(text));
    }
    this.auth.checkSetupRequired().subscribe({
      next: (s) => {
        // A fresh install has no one to sign in as yet.
        if (s.setupRequired) {
          this.router.navigateByUrl('/setup');
          return;
        }
        this.googleEnabled.set(!!s.googleEnabled);
      },
      error: () => undefined,
    });
  }

  onSubmit() {
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Invalid email or password');
        this.loading.set(false);
      },
    });
  }
}
