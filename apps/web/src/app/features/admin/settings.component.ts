/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminApiService, type AppSettings, type OrgSettings, type ThemeTokens, errorText } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** WCAG relative-luminance contrast between a colour and white. */
function contrastWithWhite(hex: string): number {
  if (!HEX.test(hex)) return 0;
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return 1.05 / (lum + 0.05);
}

@Component({
  selector: 'pvx-admin-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'admin.settings.title' | translate }}</h1>
          <p>{{ 'admin.settings.subtitle' | translate }}</p>
        </div>
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      @if (loaded()) {
        <form class="pvx-panel section" (ngSubmit)="saveOrg()">
          <h2>{{ 'admin.settings.org' | translate }}</h2>
          <div class="grid">
            <label class="pvx-field"><span>{{ 'admin.settings.orgName' | translate }}</span>
              <input class="pvx-input" name="orgName" [(ngModel)]="org.name" maxlength="80" [disabled]="!canOrg()" />
              <small>{{ 'admin.settings.orgNameHint' | translate }}</small></label>
            <label class="pvx-field"><span>{{ 'admin.settings.language' | translate }}</span>
              <select class="pvx-select" name="lang" [(ngModel)]="org.defaultLanguage" [disabled]="!canOrg()">
                <option value="en">English</option><option value="ta">தமிழ்</option>
              </select></label>
          </div>
          @if (canOrg()) {
            <div class="row-actions"><button class="pvx-btn primary" type="submit" [disabled]="busy() || org.name.trim().length < 2">{{ 'common.save' | translate }}</button></div>
          }
        </form>

        <form class="pvx-panel section" (ngSubmit)="saveTheme()">
          <h2>{{ 'admin.settings.theme' | translate }}</h2>
          <p class="hint">{{ 'admin.settings.themeHint' | translate }}</p>
          <div class="theme">
            <div class="grid">
              @for (k of colourKeys; track k) {
                <div class="pvx-field">
                  <span>{{ 'admin.settings.colours.' + k | translate }}</span>
                  <div class="colour">
                    <input type="color" [name]="k + 'Pick'" [ngModel]="theme()[k]" (ngModelChange)="setColour(k, $event)" [disabled]="!canTheme()"
                      [attr.aria-label]="'admin.settings.colours.' + k | translate" />
                    <input class="pvx-input mono" [name]="k" [ngModel]="theme()[k]" (ngModelChange)="setColour(k, $event)" maxlength="7" [disabled]="!canTheme()" />
                  </div>
                </div>
              }
              <label class="pvx-field"><span>{{ 'admin.settings.radius' | translate }}: <span class="pvx-num">{{ theme().radius }}px</span></span>
                <input type="range" name="radius" min="0" max="16" step="1" [ngModel]="theme().radius" (ngModelChange)="patch({ radius: +$event })" [disabled]="!canTheme()" /></label>
              <label class="pvx-field"><span>{{ 'admin.settings.density' | translate }}</span>
                <select class="pvx-select" name="density" [ngModel]="theme().density" (ngModelChange)="patch({ density: $event })" [disabled]="!canTheme()">
                  <option value="comfortable">{{ 'admin.settings.comfortable' | translate }}</option>
                  <option value="compact">{{ 'admin.settings.compact' | translate }}</option>
                </select></label>
            </div>

            <div class="preview" [style.--p]="theme().primary" [style.--a]="theme().accent" [style.--w]="theme().warn" [style.--r.px]="theme().radius" aria-hidden="true">
              <div class="bar">{{ org.name }}</div>
              <div class="body">
                <div class="kpi"><small>{{ 'admin.settings.sampleLabel' | translate }}</small><b class="pvx-num">82.4%</b></div>
                <div class="chips"><span class="a"></span><span class="w"></span></div>
                <span class="btn">{{ 'admin.settings.sampleButton' | translate }}</span>
              </div>
              <small class="tag">{{ 'admin.settings.previewLabel' | translate }}</small>
            </div>
          </div>

          @if (lowContrast()) {
            <p class="pvx-note error" role="alert">{{ 'admin.settings.lowContrast' | translate: { ratio: contrast().toFixed(1) } }}</p>
          }
          @if (canTheme()) {
            <div class="row-actions">
              <button class="pvx-btn primary" type="submit" [disabled]="busy() || lowContrast() || invalid()">{{ 'admin.settings.applyTheme' | translate }}</button>
              <button class="pvx-btn" type="button" (click)="resetTheme()" [disabled]="busy()">{{ 'admin.settings.resetTheme' | translate }}</button>
            </div>
          }
        </form>
      } @else if (!error()) {
        <p class="pvx-empty">{{ 'common.loading' | translate }}</p>
      }
    </div>
  `,
  styles: [`
    .section { padding: 20px 24px; margin-bottom: 20px; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .hint { color: var(--pvx-text-muted); font-size: 14px; margin: -8px 0 16px; max-width: 70ch; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px 20px; }
    .theme { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
    @media (max-width: 900px) { .theme { grid-template-columns: 1fr; } }
    .colour { display: flex; gap: 8px; }
    .colour input[type=color] { width: 44px; height: 40px; padding: 2px; border: 1px solid var(--pvx-border-strong); border-radius: var(--pvx-radius); background: var(--pvx-bg-card); cursor: pointer; }
    .mono { font-family: var(--pvx-font-code); text-transform: uppercase; }
    input[type=range] { accent-color: var(--pvx-primary); }
    .row-actions { display: flex; gap: 8px; margin-top: 20px; }
    .pvx-note { margin: 16px 0 0; }
    :host > .pvx-page > .pvx-note { margin: 0 0 16px; }
    .preview { position: relative; border: 1px solid var(--pvx-border); border-radius: var(--r); overflow: hidden; background: #f8fafc; color: #0f172a; }
    .preview .bar { background: var(--p); color: #fff; padding: 10px 14px; font-weight: 600; font-size: 14px; }
    .preview .body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .kpi small { display: block; font-size: 12px; color: #475569; }
    .kpi b { font-size: 26px; }
    .chips { display: flex; gap: 6px; }
    .chips span { width: 40px; height: 8px; border-radius: 4px; }
    .chips .a { background: var(--a); } .chips .w { background: var(--w); }
    .btn { align-self: flex-start; background: var(--p); color: #fff; padding: 8px 14px; border-radius: var(--r); font-size: 13px; font-weight: 600; }
    .tag { position: absolute; right: 10px; bottom: 8px; font-size: 11px; color: #475569; }
  `],
})
export class AdminSettingsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly t = inject(TranslateService);

  readonly colourKeys = ['primary', 'accent', 'warn'] as const;
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly theme = signal<ThemeTokens>({ primary: '#1E3A8A', accent: '#14B8A6', warn: '#F97316', radius: 8, density: 'comfortable' });
  readonly canOrg = computed(() => this.auth.can('settings:write'));
  readonly canTheme = computed(() => this.auth.can('theme:write'));
  readonly contrast = computed(() => contrastWithWhite(this.theme().primary));
  readonly invalid = computed(() => this.colourKeys.some((k) => !HEX.test(this.theme()[k])));
  /** White text on the primary colour must stay readable: WCAG AA, 4.5:1. */
  readonly lowContrast = computed(() => !this.invalid() && this.contrast() < 4.5);

  org: OrgSettings = { name: '', defaultLanguage: 'en' };

  ngOnInit() {
    this.api.settings().subscribe({
      next: (s) => this.take(s),
      error: (e) => this.error.set(errorText(e)),
    });
  }

  private take(s: AppSettings) {
    this.org = { ...s.org };
    this.theme.set({ ...s.theme });
    this.themeService.orgName.set(s.org.name);
    this.themeService.applyTokens(s.theme);
    this.loaded.set(true);
  }

  setColour(key: 'primary' | 'accent' | 'warn', value: string) {
    this.patch({ [key]: String(value).toUpperCase() } as Partial<ThemeTokens>);
  }

  patch(p: Partial<ThemeTokens>) {
    this.theme.update((t) => ({ ...t, ...p }));
  }

  private result(message: string) {
    return {
      next: (s: AppSettings) => {
        this.take(s);
        this.busy.set(false);
        this.error.set('');
        this.notice.set(message);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.notice.set('');
        this.error.set(errorText(e));
      },
    };
  }

  saveOrg() {
    this.busy.set(true);
    this.api.saveSettings({ org: { name: this.org.name.trim(), defaultLanguage: this.org.defaultLanguage } }).subscribe(this.result(this.t.instant('admin.settings.savedOrg')));
  }

  saveTheme() {
    this.busy.set(true);
    this.api.saveSettings({ theme: this.theme() }).subscribe(this.result(this.t.instant('admin.settings.savedTheme')));
  }

  resetTheme() {
    this.busy.set(true);
    this.api.resetTheme().subscribe(this.result(this.t.instant('admin.settings.resetDone')));
  }
}
