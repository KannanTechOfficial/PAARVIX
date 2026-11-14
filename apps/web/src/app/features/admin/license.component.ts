/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminApiService, type FeatureRow, type LicenseStatusView, errorText } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';

const day = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const ddmmyyyy = (iso?: string) => (iso ? day.format(new Date(iso)).replace(/\//g, '-') : '');

@Component({
  selector: 'pvx-admin-license',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'license.title' | translate }}</h1>
          <p>{{ 'license.lead' | translate }}</p>
        </div>
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      @if (status(); as s) {
        <section class="pvx-panel card" aria-labelledby="lic-h">
          <div class="row">
            <div>
              <p class="eyebrow">{{ 'license.current' | translate }}</p>
              <h2 id="lic-h">Paarvix {{ ('license.editions.' + s.edition) | translate }}</h2>
              @if (s.customer) { <p class="meta">{{ 'license.for' | translate: { customer: s.customer } }}</p> }
            </div>
            <span class="pvx-tag state" [class.ok]="s.state === 'active' || s.state === 'community'" [class.warn]="s.state === 'grace' || s.state === 'expired' || s.state === 'invalid'">
              {{ ('license.state.' + s.state) | translate }}</span>
          </div>

          @if (s.state === 'active') {
            <p class="meta">{{ 'license.expires' | translate: { date: fmt(s.expiresAt), days: s.daysLeft } }}</p>
          }
          @if (s.state === 'grace') {
            <p class="pvx-note warn">{{ 'license.graceNote' | translate: { date: fmt(s.graceEndsAt) } }}</p>
          }
          @if (s.state === 'expired') {
            <p class="pvx-note warn">{{ 'license.expiredNote' | translate }}</p>
          }
          @if (s.problem) { <p class="pvx-note error">{{ s.problem }}</p> }
          @if (s.state === 'community') { <p class="meta">{{ 'license.communityNote' | translate }}</p> }

          <p class="meta small">{{ 'license.instance' | translate }} <code>{{ s.instanceId }}</code></p>
        </section>

        @if (s.fromEnvironment) {
          <p class="pvx-note info">{{ 'license.fromEnv' | translate }}</p>
        } @else if (auth.isSuperAdmin()) {
          <section class="pvx-panel card" aria-labelledby="key-h">
            <h2 id="key-h">{{ 'license.add' | translate }}</h2>
            <p class="meta">{{ 'license.addHint' | translate }}</p>
            <form (ngSubmit)="activate()">
              <label class="pvx-sr-only" for="lic-key">{{ 'license.key' | translate }}</label>
              <textarea id="lic-key" class="pvx-input key" name="key" [(ngModel)]="key" rows="4" spellcheck="false" autocomplete="off"
                [placeholder]="'license.keyPlaceholder' | translate"></textarea>
              <div class="actions">
                <button type="submit" class="pvx-btn primary" [disabled]="busy() || key.trim().length < 20">{{ 'license.activate' | translate }}</button>
                @if (s.licenseId) {
                  <button type="button" class="pvx-btn ghost danger" (click)="remove()" [disabled]="busy()">{{ 'license.remove' | translate }}</button>
                }
              </div>
            </form>
          </section>
        }

        <section class="pvx-panel card" aria-labelledby="ed-h">
          <h2 id="ed-h">{{ 'license.whatsIncluded' | translate }}</h2>
          @for (group of groups(); track group.edition) {
            <h3>Paarvix {{ ('license.editions.' + group.edition) | translate }}</h3>
            @if (group.edition === 'community') { <p class="meta">{{ 'license.communityAlways' | translate }}</p> }
            <ul>
              @for (f of group.items; track f.id) {
                <li>
                  <span>{{ f.label }}</span>
                  <span class="pvx-tag" [class.ok]="f.enabled && f.built">{{ (!f.built ? 'license.coming' : f.enabled ? 'admin.plugins.on' : 'license.needs') | translate }}</span>
                </li>
              }
            </ul>
          }
          <p class="meta">{{ 'license.contact' | translate }} <a href="mailto:support@kannantech.com">support&#64;kannantech.com</a></p>
        </section>
      } @else if (!error()) {
        <p class="pvx-empty">{{ 'common.loading' | translate }}</p>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 860px; display: flex; flex-direction: column; gap: 16px; }
    .card { padding: 20px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--pvx-text-muted); }
    h2 { font-size: 20px; font-weight: 650; margin-top: 2px; }
    h3 { font-size: 15px; font-weight: 650; margin: 18px 0 6px; }
    .meta { color: var(--pvx-text-muted); font-size: 14px; margin-top: 6px; }
    .small { font-size: 13px; }
    code { font-family: var(--pvx-font-mono); font-size: 12px; overflow-wrap: anywhere; }
    .pvx-note { margin-top: 12px; }
    .key { width: 100%; margin-top: 12px; font-family: var(--pvx-font-mono); font-size: 13px; resize: vertical; }
    .actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--pvx-border); font-size: 14px; }
    li:first-child { border-top: 0; }
    .state.warn { color: var(--pvx-bad); }
  `],
})
export class AdminLicenseComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly t = inject(TranslateService);

  readonly status = signal<LicenseStatusView | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  key = '';

  readonly groups = computed(() => {
    const all = this.status()?.features ?? [];
    return (['community', 'pro', 'enterprise'] as const).map((edition) => ({
      edition,
      items: all.filter((f: FeatureRow) => f.edition === edition),
    }));
  });

  fmt = ddmmyyyy;

  ngOnInit() {
    this.api.license().subscribe({ next: (s) => this.status.set(s), error: (e) => this.error.set(errorText(e)) });
  }

  activate() {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.activateLicense(this.key.trim()).subscribe({
      next: () => {
        this.key = '';
        this.notice.set(this.t.instant('license.activated'));
        this.reload();
      },
      error: (e) => {
        this.error.set(errorText(e));
        this.busy.set(false);
      },
    });
  }

  remove() {
    this.busy.set(true);
    this.notice.set('');
    this.api.removeLicense().subscribe({
      next: () => {
        this.notice.set(this.t.instant('license.removed'));
        this.reload();
      },
      error: (e) => {
        this.error.set(errorText(e));
        this.busy.set(false);
      },
    });
  }

  private reload() {
    this.api.license().subscribe({
      next: (s) => {
        this.status.set(s);
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(errorText(e));
        this.busy.set(false);
      },
    });
  }
}
