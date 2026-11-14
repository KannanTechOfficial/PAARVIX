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
    <div class="page">
      <aside class="brand-panel" aria-hidden="true">
        <div class="brand-top">
          <img src="icons/icon-192.png" alt="" width="36" height="36" />
          <span>Paarvix</span>
        </div>
        <div class="brand-copy">
          <p class="tagline">{{ 'app.tagline' | translate }}</p>
          <p class="story">{{ 'auth.story' | translate }}</p>
        </div>
        <p class="brand-foot">KannanTech</p>
      </aside>

      <main class="form-side">
        <div class="form-wrap">
          <div class="mobile-brand">
            <img src="icons/icon-192.png" alt="" width="40" height="40" />
          </div>
          <h1>{{ 'auth.welcome' | translate }}</h1>
          <p class="sub">{{ 'auth.welcomeSub' | translate }}</p>

          @if (error()) {
            <p class="pvx-note error" role="alert">{{ error() }}</p>
          }

          @if (googleEnabled()) {
            <a class="google" href="/api/auth/google">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>
              {{ 'auth.google' | translate }}
            </a>
            <div class="or"><span>{{ 'auth.orEmail' | translate }}</span></div>
          }

          <form (ngSubmit)="onSubmit()" class="form">
            <label class="pvx-field"><span>{{ 'auth.email' | translate }}</span>
              <input class="pvx-input" type="email" [(ngModel)]="email" name="email" required autocomplete="email" placeholder="you@college.edu" /></label>
            <label class="pvx-field"><span>{{ 'auth.password' | translate }}</span>
              <input class="pvx-input" type="password" [(ngModel)]="password" name="password" required autocomplete="current-password" /></label>
            <button type="submit" class="pvx-btn primary submit" [disabled]="loading()">
              {{ loading() ? ('common.loading' | translate) : ('auth.signIn' | translate) }}
            </button>
          </form>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100dvh; display: grid; grid-template-columns: minmax(380px, 46%) 1fr; background: var(--pvx-bg); }
    @media (max-width: 900px) { .page { grid-template-columns: 1fr; } .brand-panel { display: none; } }

    /* Brand panel: deep blue with a slow accent glow; words, not fake numbers. */
    .brand-panel {
      position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
      padding: clamp(32px, 5vw, 64px); color: #fff;
      background:
        radial-gradient(60% 50% at 85% 15%, rgba(45, 212, 191, .28), transparent 70%),
        radial-gradient(70% 60% at 10% 100%, rgba(91, 140, 255, .35), transparent 70%),
        linear-gradient(160deg, #13286B 0%, #0B1640 100%);
    }
    .brand-panel::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
      background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); background-size: 22px 22px;
      mask-image: linear-gradient(180deg, transparent, #000 40%, #000 70%, transparent);
    }
    .brand-top { display: flex; align-items: center; gap: 12px; font: 600 20px var(--pvx-font-brand); position: relative; z-index: 1; }
    .brand-top img { border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
    .brand-copy { position: relative; z-index: 1; max-width: 30ch; }
    .tagline { font: 700 clamp(36px, 4vw, 56px)/1.05 var(--pvx-font-brand); letter-spacing: -0.03em; }
    .story { margin-top: 18px; font-size: 17px; line-height: 1.6; color: rgba(255,255,255,.72); max-width: 36ch; }
    .brand-foot { position: relative; z-index: 1; font-size: 13px; color: rgba(255,255,255,.5); }

    .form-side { display: grid; place-items: center; padding: clamp(24px, 6vw, 64px) 20px; }
    .form-wrap { width: min(400px, 100%); animation: rise 520ms var(--pvx-ease) both; }
    @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
    @media (prefers-reduced-motion: reduce) { .form-wrap { animation: none; } }
    .mobile-brand { display: none; margin-bottom: 20px; }
    .mobile-brand img { border-radius: 12px; box-shadow: var(--pvx-shadow-md); }
    @media (max-width: 900px) { .mobile-brand { display: block; } }
    h1 { font: 700 30px/1.15 var(--pvx-font-brand); letter-spacing: -0.025em; }
    .sub { margin: 8px 0 28px; color: var(--pvx-text-muted); font-size: 15px; }
    .pvx-note { margin-bottom: 18px; }

    .google {
      display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; border-radius: var(--pvx-radius);
      background: var(--pvx-bg-raised); color: var(--pvx-text); font: 600 15px var(--pvx-font-ui); text-decoration: none;
      box-shadow: var(--pvx-shadow-sm), inset 0 0 0 1px var(--pvx-border-strong);
      transition: transform 120ms ease-out, box-shadow 160ms ease-out;
    }
    .google:hover { text-decoration: none; box-shadow: var(--pvx-shadow-md), inset 0 0 0 1px var(--pvx-border-strong); }
    .google:active { transform: scale(.985); }
    .or { display: flex; align-items: center; gap: 12px; margin: 24px 0; color: var(--pvx-text-faint); font-size: 13px; }
    .or::before, .or::after { content: ''; flex: 1; border-top: 1px solid var(--pvx-border); }
    .form { display: flex; flex-direction: column; gap: 16px; }
    .form .pvx-input { min-height: 46px; font-size: 15px; }
    .submit { min-height: 48px; font-size: 15px; margin-top: 6px; }
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
        if (u) void this.router.navigateByUrl(this.returnUrl);
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
        // If the page cannot open (for example a dashboard that is no longer shared), the button must not stay stuck.
        this.router.navigateByUrl(this.returnUrl).then((ok) => { if (!ok) this.loading.set(false); }, () => this.loading.set(false));
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Invalid email or password');
        this.loading.set(false);
      },
    });
  }
}
