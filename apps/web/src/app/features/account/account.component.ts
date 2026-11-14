/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

interface SessionRow {
  id: string;
  method: 'password' | 'google' | 'setup' | string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

/** "Chrome on Android" from a user-agent string. Good enough to recognise a device; never used for security. */
export function describeDevice(ua: string | null): string | null {
  if (!ua) return null;
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? ua.slice(0, 60);
}

const fmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** DD-MM-YYYY, h:mm am/pm, the Paarvix date style. */
const when = { format: (d: Date) => fmt.format(d).replace(/\//g, '-') };

@Component({
  selector: 'pvx-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'account.title' | translate }}</h1>
          @if (auth.user(); as u) { <p>{{ u.name }} · {{ u.email }}</p> }
        </div>
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      <section class="pvx-panel devices" aria-labelledby="devices-h">
        <div class="head">
          <div>
            <h2 id="devices-h">{{ 'account.devices' | translate }}</h2>
            <p class="hint">{{ 'account.devicesHint' | translate }}</p>
          </div>
          @if (others() > 0) {
            <button type="button" class="pvx-btn danger small" (click)="signOutOthers()" [disabled]="busy()">{{ 'account.signOutOthers' | translate }}</button>
          }
        </div>

        @if (loading()) {
          <p class="pvx-empty">{{ 'common.loading' | translate }}</p>
        } @else {
          <ul class="list">
            @for (s of sessions(); track s.id) {
              <li [class.current]="s.current">
                <div class="info">
                  <strong>{{ s.device ?? ('account.unknownDevice' | translate) }}
                    @if (s.current) { <span class="pill">{{ 'account.thisDevice' | translate }}</span> }
                  </strong>
                  <span class="meta">
                    {{ 'account.lastActive' | translate: { date: s.lastActive } }} ·
                    {{ 'account.started' | translate: { date: s.started } }} {{ ('account.via.' + s.method) | translate }}
                    @if (s.ip) { · {{ s.ip }} }
                  </span>
                </div>
                <button type="button" class="pvx-btn small" [class.ghost]="!s.current" (click)="signOut(s)" [disabled]="busy()">{{ 'account.signOut' | translate }}</button>
              </li>
            }
          </ul>
          @if (others() === 0) { <p class="hint none">{{ 'account.none' | translate }}</p> }
        }
      </section>
    </div>
  `,
  styles: [`
    .page { max-width: 820px; }
    .devices { padding: 20px; }
    .head { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
    h2 { font-size: 17px; font-weight: 650; }
    .hint { margin-top: 4px; color: var(--pvx-text-muted); font-size: 14px; max-width: 60ch; }
    .none { margin-top: 12px; }
    .list { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; border-top: 1px solid var(--pvx-border); }
    li:first-child { border-top: 0; }
    .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .info strong { display: flex; align-items: center; gap: 8px; font-size: 15px; flex-wrap: wrap; }
    .meta { font-size: 13px; color: var(--pvx-text-muted); overflow-wrap: anywhere; }
    .pill { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--pvx-good) 14%, transparent); color: var(--pvx-good); }
  `],
})
export class AccountComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly t = inject(TranslateService);

  readonly sessions = signal<(SessionRow & { device: string | null; started: string; lastActive: string })[]>([]);
  readonly others = signal(0);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit() {
    this.load();
  }

  private load() {
    this.http.get<SessionRow[]>('/api/auth/sessions').subscribe({
      next: (rows) => {
        this.sessions.set(rows.map((r) => ({
          ...r,
          device: describeDevice(r.userAgent),
          started: when.format(new Date(r.createdAt)),
          lastActive: when.format(new Date(r.lastUsedAt)),
        })));
        this.others.set(rows.filter((r) => !r.current).length);
        this.loading.set(false);
        this.busy.set(false);
      },
      error: () => {
        this.error.set(this.t.instant('account.loadError'));
        this.loading.set(false);
        this.busy.set(false);
      },
    });
  }

  signOut(s: SessionRow) {
    // Ending the session in use is an ordinary sign-out, so the cookie is cleared too.
    if (s.current) {
      this.auth.logout();
      return;
    }
    this.busy.set(true);
    this.notice.set('');
    this.http.delete(`/api/auth/sessions/${encodeURIComponent(s.id)}`).subscribe({
      next: () => {
        this.notice.set(this.t.instant('account.endedOne'));
        this.load();
      },
      error: () => this.load(),
    });
  }

  signOutOthers() {
    this.busy.set(true);
    this.notice.set('');
    this.http.post<{ ended: number }>('/api/auth/sessions/revoke-others', {}).subscribe({
      next: (r) => {
        this.notice.set(this.t.instant('account.endedOthers', { count: r.ended }));
        this.load();
      },
      error: () => this.load(),
    });
  }
}
