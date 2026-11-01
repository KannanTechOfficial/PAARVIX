/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { QueryResult, TableSchema } from '@paarvix/shared';
import { serverMessage } from './upload.util';

interface Preview {
  fields: string[];
  rows: string[][];
  truncated: boolean;
}

/** Shows a source's tables, their columns, and the first 50 rows of one table. All values are shown as text. */
@Component({
  selector: 'pvx-source-preview',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind() === 'excel' || kind() === 'gsheet') {
      <p class="hint">{{ 'datasources.headerNote' | translate }}</p>
    }

    @if (error()) {
      <p class="err" role="alert">{{ error() }}</p>
    } @else if (loading()) {
      <p role="status">{{ 'datasources.loading' | translate }}</p>
    } @else if (tables().length === 0) {
      <p>{{ 'datasources.noTables' | translate }}</p>
    } @else {
      <div class="tabs" role="group" [attr.aria-label]="'datasources.tables' | translate">
        @for (t of tables(); track $index) {
          <button type="button" [attr.aria-pressed]="t.name === selected()" (click)="open(t.name)">
            {{ t.name }}
            @if (t.rowCount !== undefined) { <small>({{ t.rowCount }})</small> }
          </button>
        }
      </div>

      @if (current(); as table) {
        <h4>{{ 'datasources.columns' | translate }}</h4>
        <ul class="cols">
          @for (c of table.columns; track $index) {
            <li><strong>{{ c.name }}</strong> <small>{{ 'datasources.colType.' + c.type | translate }}</small></li>
          }
        </ul>
      }

      @if (rowsLoading()) {
        <p role="status">{{ 'datasources.loading' | translate }}</p>
      } @else if (rowsError()) {
        <p class="err" role="alert">{{ rowsError() }}</p>
      } @else if (preview(); as p) {
        <h4>{{ 'datasources.firstRows' | translate }}</h4>
        @if (p.rows.length === 0) {
          <p>{{ 'datasources.noRows' | translate }}</p>
        } @else {
          <div class="scroll" tabindex="0" role="region" [attr.aria-label]="'datasources.firstRows' | translate">
            <table>
              <thead>
                <tr>
                  @for (f of p.fields; track $index) { <th scope="col">{{ f }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (row of p.rows; track $index) {
                  <tr>
                    @for (cell of row; track $index) { <td>{{ cell }}</td> }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (p.truncated) {
            <p class="hint">{{ 'datasources.onlyFirst' | translate }}</p>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; margin-top: 12px; }
    .hint { color: var(--pvx-text-muted); font-size: 0.875rem; margin-bottom: 8px; }
    .err { color: var(--pvx-danger); overflow-wrap: anywhere; }
    h4 { margin: 12px 0 4px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .tabs button { min-height: 44px; max-width: 100%; overflow-wrap: anywhere; padding: 0 12px; border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); background: transparent; color: inherit; cursor: pointer; }
    .tabs button[aria-pressed='true'] { background: var(--pvx-primary); color: #fff; border-color: var(--pvx-primary); }
    .cols { display: flex; gap: 4px 16px; flex-wrap: wrap; list-style: none; overflow-wrap: anywhere; }
    .cols small { margin-left: 4px; color: var(--pvx-text-muted); }
    .scroll { overflow: auto; max-width: 100%; max-height: 420px; border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); }
    table { border-collapse: collapse; min-width: 100%; font-size: 0.875rem; }
    th, td { padding: 6px 10px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--pvx-border); }
    th { position: sticky; top: 0; background: var(--pvx-bg-card); }
  `],
})
export class SourcePreviewComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(TranslateService);

  readonly sourceId = input.required<string>();
  readonly kind = input<string>('');

  readonly tables = signal<TableSchema[]>([]);
  readonly selected = signal<string | null>(null);
  readonly preview = signal<Preview | null>(null);
  readonly loading = signal(true);
  readonly rowsLoading = signal(false);
  readonly error = signal('');
  readonly rowsError = signal('');

  current() {
    return this.tables().find((t) => t.name === this.selected());
  }

  ngOnInit() {
    this.http.get<TableSchema[]>(`/api/datasources/${this.sourceId()}/schema`).subscribe({
      next: (tables) => {
        this.tables.set(tables);
        this.loading.set(false);
        if (tables.length) this.open(tables[0].name);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(serverMessage(err) ?? this.i18n.instant('datasources.errSchema'));
      },
    });
  }

  open(table: string) {
    this.selected.set(table);
    this.preview.set(null);
    this.rowsError.set('');
    this.rowsLoading.set(true);
    this.http.post<QueryResult>(`/api/datasources/${this.sourceId()}/data`, { table, limit: 50 }).subscribe({
      next: (res) => {
        if (this.selected() !== table) return; // the user has moved to another table
        // Copy cells into plain strings so the template can only ever print text.
        const rows = res.rows.map((r) => res.fields.map((f) => cellText(Object.hasOwn(r, f) ? r[f] : null)));
        this.preview.set({ fields: res.fields, rows, truncated: res.truncated });
        this.rowsLoading.set(false);
      },
      error: (err) => {
        if (this.selected() !== table) return;
        this.rowsLoading.set(false);
        this.rowsError.set(serverMessage(err) ?? this.i18n.instant('datasources.errRows'));
      },
    });
  }
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  const date = /^(\d{4})-(\d{2})-(\d{2})T00:00:00\.000Z$/.exec(String(v)); // imported dates, shown day first
  return date ? `${date[3]}-${date[2]}-${date[1]}` : String(v);
}
