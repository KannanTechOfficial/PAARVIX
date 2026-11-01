/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'pvx-setup',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="pvx-login-page">
      <div class="pvx-login-card">
        <div class="pvx-login-header">
          <span class="pvx-login-logo">🔭</span>
          <h1>{{ 'auth.setup.title' | translate }}</h1>
          <p>{{ 'auth.setup.subtitle' | translate }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="pvx-login-form">
          <div class="pvx-field">
            <label>{{ 'auth.setup.name' | translate }}</label>
            <input type="text" [(ngModel)]="name" name="name" required />
          </div>
          <div class="pvx-field">
            <label>{{ 'auth.email' | translate }}</label>
            <input type="email" [(ngModel)]="email" name="email" required />
          </div>
          <div class="pvx-field">
            <label>{{ 'auth.password' | translate }}</label>
            <input type="password" [(ngModel)]="password" name="password" required minlength="8" />
          </div>

          @if (error()) {
            <div class="pvx-error">{{ error() }}</div>
          }

          <button type="submit" class="pvx-btn-primary" [disabled]="loading()">
            {{ loading() ? ('common.loading' | translate) : ('auth.setup.createAccount' | translate) }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .pvx-login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--pvx-bg); }
    .pvx-login-card { width: 100%; max-width: 420px; padding: 40px; background: var(--pvx-bg-card); border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .pvx-login-header { text-align: center; margin-bottom: 32px; }
    .pvx-login-logo { font-size: 48px; }
    h1 { font-family: 'Poppins', sans-serif; color: var(--pvx-primary); margin-top: 8px; }
    p { color: var(--pvx-text-muted); margin-top: 4px; }
    .pvx-login-form { display: flex; flex-direction: column; gap: 16px; }
    .pvx-field { display: flex; flex-direction: column; gap: 4px; }
    .pvx-field label { font-size: 14px; font-weight: 500; }
    .pvx-field input { padding: 10px 12px; border: 1px solid var(--pvx-border); border-radius: 8px; font-size: 14px; background: var(--pvx-bg); color: var(--pvx-text); }
    .pvx-field input:focus { outline: 2px solid var(--pvx-primary); border-color: transparent; }
    .pvx-btn-primary { padding: 12px; background: var(--pvx-primary); color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .pvx-btn-primary:hover { opacity: 0.9; }
    .pvx-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .pvx-error { padding: 8px 12px; background: #FEE2E2; color: #DC2626; border-radius: 8px; font-size: 14px; }
  `],
})
export class SetupComponent {
  name = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  onSubmit() {
    this.loading.set(true);
    this.error.set('');

    this.auth.setup({ email: this.email, name: this.name, password: this.password }).subscribe({
      next: () => this.router.navigate(['/dashboards']),
      error: (err) => {
        this.error.set(err.error?.message || 'Setup failed');
        this.loading.set(false);
      },
    });
  }
}
