/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ColumnSchema, Filter, FilterOp, QuerySpec, TableSchema } from '@paarvix/shared';
import { describeSql } from '@paarvix/shared';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/services/admin-api.service';
import { IconComponent } from '../../core/ui/icon.component';
import { DashboardsApiService, type DashboardItem } from '../../core/services/dashboards-api.service';
import { type HistoryItem, type QueryKind, QueriesApiService, type RunResult, SQL_SOURCES, type SavedQuery, type SourceItem } from './queries-api.service';
import { ResultChartComponent } from './result-chart.component';
import { SqlEditorComponent } from './sql-editor.component';

type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
interface FilterRow { column: string; op: FilterOp; value: string }
interface AggRow { fn: AggFn; column: string }
interface SortRow { column: string; dir: 'asc' | 'desc' }

const OPS_BY_TYPE: Record<ColumnSchema['type'], FilterOp[]> = {
  text: ['eq', 'ne', 'contains', 'in', 'isNull'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isNull'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'isNull'],
  boolean: ['eq', 'isNull'],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 });

/** Indian number grouping and DD-MM-YYYY dates, as CLAUDE.md §11 asks. */
function display(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return inr.format(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  if (ISO_DATE.test(s)) {
    const [d] = s.split('T');
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y}`;
  }
  return s;
}

/** A cell starting with = + - @ would run as a formula in Excel; a leading quote stops that. */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Component({
  selector: 'pvx-queries',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, ScrollingModule, TranslatePipe, IconComponent, SqlEditorComponent, ResultChartComponent],
  templateUrl: './queries.component.html',
  styleUrl: './queries.component.scss',
})
export class QueriesComponent implements OnInit {
  private readonly api = inject(QueriesApiService);
  private readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly dashApi = inject(DashboardsApiService);
  readonly editableDashboards = signal<DashboardItem[]>([]);
  readonly addingToDashboard = signal(false);
  readonly canBuildDashboards = computed(() => this.auth.can('dashboards:write'));

  // ---- data ----
  readonly sources = signal<SourceItem[]>([]);
  readonly sourcesLoaded = signal(false);
  readonly schema = signal<TableSchema[]>([]);
  readonly saved = signal<SavedQuery[]>([]);
  readonly history = signal<HistoryItem[]>([]);

  // ---- query being edited ----
  readonly mode = signal<QueryKind>('builder');
  readonly sourceId = signal('');
  readonly tableName = signal('');
  readonly columns = signal<string[]>([]);
  readonly filters = signal<FilterRow[]>([]);
  readonly aggregates = signal<AggRow[]>([]);
  readonly groupBy = signal<string[]>([]);
  readonly sort = signal<SortRow[]>([]);
  readonly limit = signal(1000);
  readonly sql = signal('');
  readonly showSql = signal(false);

  // ---- saving ----
  readonly loadedQuery = signal<SavedQuery | null>(null);
  readonly saving = signal(false);
  saveName = '';
  saveShared = false;

  // ---- results ----
  readonly result = signal<RunResult | null>(null);
  readonly running = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly view = signal<'table' | 'chart'>('table');
  readonly panel = signal<'saved' | 'history'>('saved');
  private runSub: Subscription | null = null;

  readonly canSave = computed(() => this.auth.can('queries:write'));
  readonly source = computed(() => this.sources().find((s) => s.id === this.sourceId()) ?? null);
  readonly sqlAllowed = computed(() => SQL_SOURCES.has(this.source()?.type ?? ''));
  readonly table = computed(() => this.schema().find((t) => t.name === this.tableName()) ?? null);
  readonly tableColumns = computed(() => this.table()?.columns ?? []);
  readonly numberColumns = computed(() => this.tableColumns().filter((c) => c.type === 'number'));
  readonly summarising = computed(() => this.aggregates().length > 0 || this.groupBy().length > 0);

  /** Output names, used for sorting: group columns and aggregate names when summarising, otherwise the columns shown. */
  readonly outputNames = computed(() => {
    if (this.summarising()) return [...this.groupBy(), ...this.aggregates().map((a) => this.aggName(a))];
    return this.columns().length ? this.columns() : this.tableColumns().map((c) => c.name);
  });

  readonly spec = computed<QuerySpec | null>(() => {
    const table = this.table();
    if (!table) return null;
    const typeOf = (name: string) => table.columns.find((c) => c.name === name)?.type ?? 'text';
    const filters: Filter[] = this.filters()
      .filter((f) => f.column && (f.op === 'isNull' || f.value.trim() !== ''))
      .map((f) => ({ column: f.column, op: f.op, value: this.typed(f, typeOf(f.column)) }));
    const names = new Set(this.outputNames());
    return {
      table: table.name,
      columns: this.summarising() ? undefined : this.columns().length ? this.columns() : undefined,
      filters,
      groupBy: this.groupBy().length ? this.groupBy() : undefined,
      aggregates: this.aggregates().length ? this.aggregates().map((a) => ({ fn: a.fn, column: a.column || undefined, as: this.aggName(a) })) : undefined,
      orderBy: this.sort().filter((s) => names.has(s.column)),
      limit: this.limit(),
    };
  });

  readonly sqlPreview = computed(() => {
    const s = this.spec();
    return s ? describeSql(s, this.source()?.type === 'mysql' ? 'mysql' : 'postgres') : '';
  });

  readonly canRun = computed(() => !!this.sourceId() && (this.mode() === 'sql' ? !!this.sql().trim() : !!this.table()));

  ngOnInit() {
    this.api.sources().subscribe({
      next: (list) => {
        this.sources.set(list.map(({ id, name, type }) => ({ id, name, type })));
        this.sourcesLoaded.set(true);
        if (list.length === 1) this.pickSource(list[0].id);
      },
      error: (e) => {
        this.sourcesLoaded.set(true);
        this.error.set(errorText(e));
      },
    });
    this.loadLists();
  }

  private loadLists() {
    this.api.saved().subscribe({ next: (s) => this.saved.set(s), error: () => undefined });
    this.api.history().subscribe({ next: (h) => this.history.set(h), error: () => undefined });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    // Ctrl/Cmd+Enter runs from anywhere on the page; the SQL editor handles its own.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && this.mode() === 'builder') {
      e.preventDefault();
      this.run();
    }
  }

  // ---------- choosing data ----------
  pickSource(id: string, then?: () => void) {
    this.sourceId.set(id);
    this.schema.set([]);
    this.tableName.set('');
    this.resetSteps();
    if (!SQL_SOURCES.has(this.source()?.type ?? '')) this.mode.set('builder');
    if (!id) return;
    this.api.schema(id).subscribe({
      next: (s) => {
        this.schema.set(s);
        if (then) then();
        else if (s.length === 1) this.pickTable(s[0].name);
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  pickTable(name: string) {
    this.tableName.set(name);
    this.resetSteps();
    if (name && this.mode() === 'builder') this.run(); // a first look at the rows
  }

  private resetSteps() {
    this.columns.set([]);
    this.filters.set([]);
    this.aggregates.set([]);
    this.groupBy.set([]);
    this.sort.set([]);
    this.result.set(null);
    this.error.set('');
  }

  setMode(m: QueryKind) {
    if (m === 'sql' && !this.sqlAllowed()) return;
    if (m === 'sql' && !this.sql().trim() && this.spec()) this.sql.set(this.sqlPreview()); // start from the builder's query
    this.mode.set(m);
    this.result.set(null);
    this.error.set('');
  }

  // ---------- steps ----------
  toggleColumn(name: string, on: boolean) {
    this.columns.update((c) => (on ? [...c, name] : c.filter((x) => x !== name)));
  }

  opsFor(column: string): FilterOp[] {
    const type = this.tableColumns().find((c) => c.name === column)?.type ?? 'text';
    return OPS_BY_TYPE[type];
  }

  typeOf(column: string): ColumnSchema['type'] {
    return this.tableColumns().find((c) => c.name === column)?.type ?? 'text';
  }

  addFilter() {
    const first = this.tableColumns()[0];
    if (!first) return;
    this.filters.update((f) => [...f, { column: first.name, op: OPS_BY_TYPE[first.type][0], value: '' }]);
  }

  updateFilter(i: number, patch: Partial<FilterRow>) {
    this.filters.update((list) =>
      list.map((f, j) => {
        if (j !== i) return f;
        const next = { ...f, ...patch };
        // A new column may not support the old operator.
        if (patch.column && !this.opsFor(patch.column).includes(next.op)) next.op = this.opsFor(patch.column)[0];
        return next;
      }),
    );
  }

  removeFilter(i: number) {
    this.filters.update((f) => f.filter((_, j) => j !== i));
  }

  private typed(f: FilterRow, type: ColumnSchema['type']): Filter['value'] {
    if (f.op === 'isNull') return null;
    if (f.op === 'in') return f.value.split(',').map((v) => v.trim()).filter(Boolean);
    if (type === 'number') {
      const n = Number(f.value.replace(/,/g, ''));
      return Number.isFinite(n) ? n : f.value;
    }
    if (type === 'boolean') return /^(true|yes|1)$/i.test(f.value.trim());
    return f.value;
  }

  aggName(a: AggRow): string {
    const label = this.t.instant(`queries.agg.${a.fn}`);
    return a.column ? `${label} of ${a.column}` : label;
  }

  addAggregate() {
    this.aggregates.update((a) => [...a, { fn: 'count', column: '' }]);
  }

  updateAggregate(i: number, patch: Partial<AggRow>) {
    this.aggregates.update((list) =>
      list.map((a, j) => {
        if (j !== i) return a;
        const next = { ...a, ...patch };
        if ((next.fn === 'sum' || next.fn === 'avg') && !this.numberColumns().some((c) => c.name === next.column)) {
          next.column = this.numberColumns()[0]?.name ?? '';
        }
        if (next.fn !== 'count' && !next.column) next.column = (next.fn === 'sum' || next.fn === 'avg' ? this.numberColumns() : this.tableColumns())[0]?.name ?? '';
        return next;
      }),
    );
  }

  removeAggregate(i: number) {
    this.aggregates.update((a) => a.filter((_, j) => j !== i));
  }

  toggleGroup(name: string, on: boolean) {
    this.groupBy.update((g) => (on ? [...g, name] : g.filter((x) => x !== name)));
  }

  addSort() {
    const first = this.outputNames()[0];
    if (first) this.sort.update((s) => [...s, { column: first, dir: 'desc' }]);
  }

  updateSort(i: number, patch: Partial<SortRow>) {
    this.sort.update((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  removeSort(i: number) {
    this.sort.update((s) => s.filter((_, j) => j !== i));
  }

  setLimit(v: unknown) {
    const n = Math.floor(Number(v));
    this.limit.set(Number.isFinite(n) ? Math.min(Math.max(n, 1), 10000) : 1000);
  }

  // ---------- running ----------
  run() {
    if (!this.canRun()) return;
    this.runSub?.unsubscribe(); // a newer run replaces the one in flight
    this.running.set(true);
    this.error.set('');
    this.notice.set('');
    const body = this.mode() === 'sql'
      ? { datasourceId: this.sourceId(), kind: 'sql' as const, sql: this.sql() }
      : { datasourceId: this.sourceId(), kind: 'builder' as const, spec: this.spec()! };
    this.runSub = this.api.run(body).subscribe({
      next: (r) => {
        this.result.set(r);
        this.running.set(false);
        this.api.history().subscribe({ next: (h) => this.history.set(h), error: () => undefined });
      },
      error: (e) => {
        this.result.set(null);
        this.running.set(false);
        this.error.set(errorText(e));
        this.api.history().subscribe({ next: (h) => this.history.set(h), error: () => undefined });
      },
    });
  }

  cell(v: unknown): string {
    return display(v);
  }

  isNumberCell(v: unknown): boolean {
    return typeof v === 'number';
  }

  exportCsv() {
    const r = this.result();
    if (!r) return;
    const lines = [r.fields.map(csvCell).join(','), ...r.rows.map((row) => r.fields.map((f) => csvCell(row[f])).join(','))];
    // A byte-order mark lets Excel open Tamil and other non-Latin text correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = (this.loadedQuery()?.name || this.tableName() || 'query').replace(/[^\w\- ]+/g, '').trim() || 'query';
    a.download = `${base}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- saved and history ----------
  private body() {
    return this.mode() === 'sql'
      ? { datasourceId: this.sourceId(), kind: 'sql' as const, sql: this.sql() }
      : { datasourceId: this.sourceId(), kind: 'builder' as const, spec: this.spec()! };
  }

  startSave() {
    const q = this.loadedQuery();
    this.saveName = q?.name ?? this.tableName();
    this.saveShared = q?.visibility === 'shared';
    this.saving.set(true);
  }

  save(asNew = false) {
    const q = this.loadedQuery();
    const payload = { ...this.body(), name: this.saveName.trim(), description: q?.description ?? '', visibility: this.saveShared ? 'shared' as const : 'private' as const };
    const owned = q && q.createdBy === this.auth.user()?.id;
    const req = owned && !asNew ? this.api.update(q.id, payload) : this.api.save(payload);
    req.subscribe({
      next: (s) => {
        this.saving.set(false);
        this.notice.set(this.t.instant('queries.savedAs', { name: s.name }));
        this.api.saved().subscribe({
          next: (list) => {
            this.saved.set(list);
            this.loadedQuery.set(list.find((x) => x.id === s.id) ?? null);
          },
        });
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  isMine(q: SavedQuery): boolean {
    return q.createdBy === this.auth.user()?.id;
  }

  openSaved(q: SavedQuery) {
    this.loadedQuery.set(q);
    this.applyQuery(q.datasourceId, q.kind, q.kind === 'builder' ? (q.querySpec as QuerySpec) : null, q.sql);
  }

  openHistory(h: HistoryItem) {
    this.loadedQuery.set(null);
    this.applyQuery(h.datasourceId, h.kind, h.querySpec, h.sql);
  }

  /** Loads a stored query back into the builder or the SQL editor, then runs it. */
  private applyQuery(datasourceId: string, kind: QueryKind, spec: QuerySpec | null, sql: string | null) {
    if (!this.sources().some((s) => s.id === datasourceId)) {
      this.error.set(this.t.instant('queries.sourceGone'));
      return;
    }
    this.pickSource(datasourceId, () => {
      if (kind === 'sql') {
        this.mode.set('sql');
        this.sql.set(sql ?? '');
        this.run();
        return;
      }
      this.mode.set('builder');
      if (!spec || !this.schema().some((t) => t.name === spec.table)) {
        this.error.set(this.t.instant('queries.tableGone'));
        return;
      }
      this.tableName.set(spec.table);
      this.columns.set(spec.columns ?? []);
      this.filters.set((spec.filters ?? []).map((f) => ({
        column: f.column,
        op: f.op,
        value: f.value === null || f.value === undefined ? '' : Array.isArray(f.value) ? f.value.join(', ') : String(f.value),
      })));
      this.groupBy.set(spec.groupBy ?? []);
      this.aggregates.set((spec.aggregates ?? []).map((a) => ({ fn: a.fn, column: a.column ?? '' })));
      this.sort.set(spec.orderBy ?? []);
      this.limit.set(spec.limit ?? 1000);
      this.run();
    });
  }

  deleteSaved(q: SavedQuery) {
    if (!confirm(this.t.instant('queries.confirmDelete', { name: q.name }))) return;
    this.api.remove(q.id).subscribe({
      next: () => {
        if (this.loadedQuery()?.id === q.id) this.loadedQuery.set(null);
        this.saved.update((s) => s.filter((x) => x.id !== q.id));
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  /** Opens a dashboard's editor with this saved query already placed as a new panel. */
  startAddToDashboard() {
    this.dashApi.list().subscribe({
      next: (list) => {
        this.editableDashboards.set(list.filter((d) => d.canEdit));
        this.addingToDashboard.set(true);
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  addToDashboard(dashboardId: string) {
    const q = this.loadedQuery();
    if (!q || !dashboardId) return;
    this.router.navigate(['/d', dashboardId], { queryParams: { addQuery: q.id } });
  }

  clearHistory() {
    this.api.clearHistory().subscribe({ next: () => this.history.set([]), error: (e) => this.error.set(errorText(e)) });
  }

  newQuery() {
    this.loadedQuery.set(null);
    this.sql.set('');
    this.resetSteps();
    this.tableName.set('');
  }

  timeOf(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    const today = new Date().toDateString() === d.toDateString();
    return today ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  historyLabel(h: HistoryItem): string {
    if (h.kind === 'sql') return (h.sql ?? '').replace(/\s+/g, ' ').slice(0, 60);
    const s = h.querySpec;
    if (!s) return '—';
    const parts = [s.table];
    if (s.filters?.length) parts.push(this.t.instant('queries.historyFilters', { count: s.filters.length }));
    if (s.groupBy?.length) parts.push(this.t.instant('queries.historyBy', { cols: s.groupBy.join(', ') }));
    return parts.join(' · ');
  }
}
