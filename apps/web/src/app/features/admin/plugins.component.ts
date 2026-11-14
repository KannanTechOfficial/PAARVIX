/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminApiService, type ConnectorInfo, type PermissionCatalog, errorText } from '../../core/services/admin-api.service';

/** Lists only what is really installed. Third-party plugins arrive with the plugin system (P2). */
@Component({
  selector: 'pvx-admin-plugins',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'admin.plugins.title' | translate }}</h1>
          <p>{{ 'admin.plugins.subtitle' | translate }}</p>
        </div>
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }

      <h2>{{ 'admin.plugins.connectors' | translate }}</h2>
      <div class="pvx-table-wrap">
        <table class="pvx-table">
          <thead><tr>
            <th scope="col">{{ 'admin.plugins.name' | translate }}</th>
            <th scope="col">{{ 'admin.plugins.kind' | translate }}</th>
            <th scope="col">{{ 'admin.plugins.sql' | translate }}</th>
            <th scope="col">{{ 'admin.plugins.status' | translate }}</th>
          </tr></thead>
          <tbody>
            @for (c of connectors(); track c.type) {
              <tr>
                <td><strong>{{ 'admin.plugins.types.' + c.type | translate }}</strong></td>
                <td>{{ (c.type === 'excel' || c.type === 'gsheet' ? 'admin.plugins.imported' : 'admin.plugins.live') | translate }}</td>
                <td>{{ (c.supportsRawSql ? 'admin.plugins.yes' : 'admin.plugins.no') | translate }}</td>
                <td><span class="pvx-tag ok">{{ 'admin.plugins.builtIn' | translate }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="pvx-empty">{{ 'common.loading' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <h2>{{ 'admin.plugins.features' | translate }}</h2>
      <p class="lead">{{ 'admin.plugins.featuresHint' | translate }}</p>
      <div class="pvx-table-wrap">
        <table class="pvx-table">
          <tbody>
            @for (f of features(); track f.id) {
              <tr>
                <td>{{ 'admin.features.' + f.id | translate }}</td>
                <td class="end">
                  <span class="pvx-tag" [class.ok]="f.enabled">{{ (f.enabled ? 'admin.plugins.on' : 'admin.plugins.off') | translate }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="pvx-note info later">{{ 'admin.plugins.later' | translate }}</p>
    </div>
  `,
  styles: [`
    h2 { font-size: 16px; font-weight: 600; margin: 28px 0 12px; }
    .pvx-page-head + h2, .pvx-note + h2 { margin-top: 0; }
    .lead { color: var(--pvx-text-muted); font-size: 14px; margin: -4px 0 12px; max-width: 70ch; }
    td.end { text-align: right; }
    .later { margin-top: 28px; }
    .pvx-note.error { margin-bottom: 16px; }
  `],
})
export class PluginsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly connectors = signal<ConnectorInfo[]>([]);
  readonly features = signal<PermissionCatalog['features']>([]);
  readonly error = signal('');

  ngOnInit() {
    this.api.connectors().subscribe({
      next: (c) => this.connectors.set(c),
      error: (e) => this.error.set(errorText(e)),
    });
    // The feature list needs roles:read; without it the section stays empty instead of failing the page.
    this.api.permissions().subscribe({ next: (c) => this.features.set(c.features), error: () => this.features.set([]) });
  }
}
