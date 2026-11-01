/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'pvx-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="pvx-login-page">
      <div class="pvx-login-card">
        <div class="pvx-login-header">
          <span class="pvx-login-logo">🔭</span>
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

        <div class="pvx-login-footer">
          <span>First-time deployment? <a routerLink="/setup" class="pvx-setup-link">Run Setup Wizard</a></span>
        </div>
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
export class LoginComponent {
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  onSubmit() {
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboards']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Invalid email or password');
        this.loading.set(false);
      },
    });
  }
}
