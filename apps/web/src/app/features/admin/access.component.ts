/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, type AccessMatrix, type RowRule, errorText } from '../../core/services/admin-api.service';

@Component({
  selector: 'pvx-admin-access',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, FormsModule],
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

      @if (matrix(); as m) {
        <section class="rules">
          <h2>{{ 'admin.rules.title' | translate }}</h2>
          <p class="lead">{{ 'admin.rules.lead' | translate }}</p>

          <div class="pvx-table-wrap">
            <table class="pvx-table">
              <thead><tr>
                <th scope="col">{{ 'admin.rules.role' | translate }}</th>
                <th scope="col">{{ 'admin.access.source' | translate }}</th>
                <th scope="col">{{ 'admin.rules.rule' | translate }}</th>
                <th scope="col"><span class="pvx-sr-only">{{ 'admin.actions' | translate }}</span></th>
              </tr></thead>
              <tbody>
                @for (r of rules(); track r.id) {
                  <tr>
                    <td><strong>{{ r.role.name }}</strong></td>
                    <td>{{ r.datasource.name }}</td>
                    <td>{{ 'admin.rules.sentence' | translate: { column: r.column, attribute: r.attribute } }}</td>
                    <td class="end"><button type="button" class="pvx-btn small danger" (click)="removeRule(r)">{{ 'admin.rules.remove' | translate }}</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="pvx-empty">{{ 'admin.rules.none' | translate }}</td></tr>
                }
              </tbody>
            </table>
          </div>

          <form class="pvx-panel add" (ngSubmit)="addRule()">
            <h3>{{ 'admin.rules.add' | translate }}</h3>
            <div class="grid">
              <label class="pvx-field"><span>{{ 'admin.rules.forRole' | translate }}</span>
                <select class="pvx-select" name="role" [(ngModel)]="draft.roleId">
                  @for (r of m.roles; track r.id) { @if (r.key !== 'super_admin') { <option [value]="r.id">{{ r.name }}</option> } }
                </select></label>
              <label class="pvx-field"><span>{{ 'admin.rules.onSource' | translate }}</span>
                <select class="pvx-select" name="source" [ngModel]="draft.datasourceId" (ngModelChange)="pickSource($event)">
                  @for (s of m.sources; track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                </select></label>
              <label class="pvx-field"><span>{{ 'admin.rules.column' | translate }}</span>
                <select class="pvx-select" name="column" [(ngModel)]="draft.column">
                  @for (c of columns(); track c) { <option [value]="c">{{ c }}</option> }
                </select>
                <small>{{ 'admin.rules.columnHint' | translate }}</small></label>
              <label class="pvx-field"><span>{{ 'admin.rules.attribute' | translate }}</span>
                <input class="pvx-input" name="attribute" [(ngModel)]="draft.attribute" list="pvx-attrs" spellcheck="false" />
                <datalist id="pvx-attrs"><option value="email"></option><option value="department"></option><option value="reg_no"></option><option value="staff_id"></option></datalist>
                <small>{{ 'admin.rules.attributeHint' | translate }}</small></label>
            </div>
            <button class="pvx-btn primary" type="submit" [disabled]="busy() || !draft.roleId || !draft.datasourceId || !draft.column || !draft.attribute">{{ 'admin.rules.addButton' | translate }}</button>
          </form>
        </section>
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
    .rules { margin-top: 40px; }
    .rules h2 { font-size: 18px; font-weight: 700; }
    .rules .lead { color: var(--pvx-text-muted); font-size: 14px; margin: 4px 0 16px; max-width: 75ch; }
    .rules td.end { text-align: right; }
    .add { margin-top: 16px; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
    .add h3 { font-size: 15px; font-weight: 600; }
    .add .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 16px; width: 100%; }
    .legend { margin-top: 12px; font-size: 13px; color: var(--pvx-text-muted); max-width: 75ch; }
  `],
})
export class AccessComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly t = inject(TranslateService);

  readonly matrix = signal<AccessMatrix | null>(null);
  readonly rules = signal<RowRule[]>([]);
  readonly columns = signal<string[]>([]);
  draft = { roleId: '', datasourceId: '', column: '', attribute: 'reg_no' };
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit() {
    this.api.access().subscribe({
      next: (m) => {
        this.matrix.set(m);
        this.draft.roleId = m.roles.find((r) => r.key !== 'super_admin' && !r.alwaysAllowed)?.id ?? '';
        if (m.sources[0]) this.pickSource(m.sources[0].id);
      },
      error: (e) => this.error.set(errorText(e)),
    });
    this.loadRules();
  }

  private loadRules() {
    this.api.rules().subscribe({ next: (r) => this.rules.set(r), error: () => undefined });
  }

  /** Offers every column name found in the source's tables; a rule applies to each table that has it. */
  pickSource(id: string) {
    this.draft.datasourceId = id;
    this.columns.set([]);
    this.api.sourceColumns(id).subscribe({
      next: (tables) => {
        const names = [...new Set(tables.flatMap((t) => t.columns.map((c) => c.name)))].sort();
        this.columns.set(names);
        this.draft.column = names.includes('reg_no') ? 'reg_no' : names[0] ?? '';
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  addRule() {
    const d = this.draft;
    this.busy.set(true);
    this.api.addRule(d.datasourceId, { roleId: d.roleId, column: d.column, attribute: d.attribute.trim() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.error.set('');
        this.notice.set(this.t.instant('admin.rules.added'));
        this.loadRules();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errorText(e));
      },
    });
  }

  removeRule(r: RowRule) {
    if (!confirm(this.t.instant('admin.rules.confirmRemove', { role: r.role.name, source: r.datasource.name }))) return;
    this.api.removeRule(r.id).subscribe({
      next: () => {
        this.notice.set(this.t.instant('admin.rules.removed'));
        this.loadRules();
      },
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
