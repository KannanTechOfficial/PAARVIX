/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminApiService, type AccessMatrix, errorText } from '../../core/services/admin-api.service';

@Component({
  selector: 'pvx-admin-access',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'admin.access.title' | translate }}</h1>
          <p>{{ 'admin.access.subtitle' | translate }}</p>
        </div>
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      @if (matrix(); as m) {
        @if (m.sources.length === 0) {
          <div class="pvx-panel pvx-empty">
            <p>{{ 'admin.access.noSources' | translate }}</p>
            <a class="pvx-btn primary" routerLink="/datasources">{{ 'admin.access.addSource' | translate }}</a>
          </div>
        } @else {
          <div class="pvx-table-wrap">
            <table class="pvx-table">
              <caption class="pvx-sr-only">{{ 'admin.access.title' | translate }}</caption>
              <thead><tr>
                <th scope="col">{{ 'admin.access.source' | translate }}</th>
                @for (r of m.roles; track r.id) { <th scope="col" class="c">{{ r.name }}</th> }
              </tr></thead>
              <tbody>
                @for (s of m.sources; track s.id) {
                  <tr>
                    <th scope="row" class="src"><strong>{{ s.name }}</strong><span>{{ 'admin.plugins.types.' + s.type | translate }}</span></th>
                    @for (r of m.roles; track r.id) {
                      <td class="c">
                        @if (r.alwaysAllowed) {
                          <span class="pvx-tag ok" [title]="'admin.access.alwaysHint' | translate">{{ 'admin.access.always' | translate }}</span>
                        } @else if (!r.canQuery) {
                          <span class="pvx-tag" [title]="'admin.access.noQueryHint' | translate">{{ 'admin.access.noQuery' | translate }}</span>
                        } @else {
                          <label class="pvx-check box">
                            <input type="checkbox" [checked]="s.roleIds.includes(r.id)" [disabled]="busy()"
                              (change)="toggle(s.id, r.id, $any($event.target).checked)" />
                            <span class="pvx-sr-only">{{ 'admin.access.allow' | translate: { role: r.name, source: s.name } }}</span>
                          </label>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="legend">{{ 'admin.access.legend' | translate }}</p>
        }
      } @else if (!error()) {
        <p class="pvx-empty">{{ 'common.loading' | translate }}</p>
      }
    </div>
  `,
  styles: [`
    .pvx-note { margin-bottom: 16px; }
    .pvx-empty .pvx-btn { margin-top: 16px; }
    th.c, td.c { text-align: center; }
    th.src { text-align: left; background: none; font-size: 14px; color: var(--pvx-text); padding: 10px 16px; border-bottom: 1px solid var(--pvx-border); }
    th.src span { display: block; font-size: 12px; font-weight: 400; color: var(--pvx-text-muted); }
    tr:last-child th.src { border-bottom: 0; }
    .box { justify-content: center; }
    .legend { margin-top: 12px; font-size: 13px; color: var(--pvx-text-muted); max-width: 75ch; }
  `],
})
export class AccessComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly t = inject(TranslateService);

  readonly matrix = signal<AccessMatrix | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit() {
    this.api.access().subscribe({
      next: (m) => this.matrix.set(m),
      error: (e) => this.error.set(errorText(e)),
    });
  }

  toggle(sourceId: string, roleId: string, on: boolean) {
    const m = this.matrix();
    const source = m?.sources.find((s) => s.id === sourceId);
    if (!m || !source) return;
    const roleIds = on ? [...new Set([...source.roleIds, roleId])] : source.roleIds.filter((r) => r !== roleId);
    this.busy.set(true);
    this.api.setAccess(sourceId, roleIds).subscribe({
      next: () => {
        this.matrix.set({ ...m, sources: m.sources.map((s) => (s.id === sourceId ? { ...s, roleIds } : s)) });
        this.busy.set(false);
        this.error.set('');
        this.notice.set(this.t.instant('admin.access.saved', { source: source.name }));
      },
      error: (e) => {
        this.busy.set(false);
        this.notice.set('');
        this.error.set(errorText(e));
        this.matrix.set({ ...m });
      },
    });
  }
}
