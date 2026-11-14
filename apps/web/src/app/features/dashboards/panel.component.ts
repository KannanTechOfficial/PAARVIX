/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { DashboardPanel } from '@paarvix/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { Subscription } from 'rxjs';
import { DashboardsApiService, type PanelResult } from '../../core/services/dashboards-api.service';
import { errorText } from '../../core/services/admin-api.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../core/ui/icon.component';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const PIE_SLICES = 9;
const SERIES = ['#1E3A8A', '#0D9488', '#EA580C', '#7C3AED', '#64748B', '#0284C7'];
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const numeric = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));

function show(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (numeric(v)) return inr.format(Number(v));
  const s = String(v);
  if (ISO_DATE.test(s)) {
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}-${m}-${y}`;
  }
  return s;
}

/** One panel. It asks the server for its own data by dashboard and panel id, never by query. */
@Component({
  selector: 'pvx-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, NgxEchartsDirective, IconComponent],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <article class="panel" [class.editing]="editing()">
      <header>
        <h3 [attr.title]="panel().title">{{ panel().title || ('dashboards.untitledPanel' | translate) }}</h3>
        @if (editing()) {
          <button type="button" class="icon" (click)="edit.emit()" [attr.aria-label]="'dashboards.editPanel' | translate"><pvx-icon name="settings" [size]="16" /></button>
          <button type="button" class="icon" (click)="remove.emit()" [attr.aria-label]="'dashboards.removePanel' | translate"><pvx-icon name="close" [size]="16" /></button>
        } @else if (panel().viz.type !== 'text' && panel().viz.type !== 'table' && result()) {
          <button type="button" class="icon" (click)="asTable.set(!asTable())" [attr.aria-pressed]="asTable()"
            [attr.aria-label]="(asTable() ? 'dashboards.showChart' : 'dashboards.showTable') | translate">
            <pvx-icon [name]="asTable() ? 'dashboards' : 'templates'" [size]="16" /></button>
        }
      </header>

      <div class="body">
        @if (panel().viz.type === 'text') {
          <p class="text">{{ panel().viz.text }}</p>
        } @else if (loading()) {
          <div class="skeleton" aria-busy="true"><span></span><span></span><span></span></div>
        } @else if (error()) {
          <p class="err" role="alert">{{ error() }}</p>
        } @else if (result(); as r) {
          @if (r.rows.length === 0) {
            <p class="muted">{{ 'dashboards.noRows' | translate }}</p>
          } @else if (asTable() || panel().viz.type === 'table') {
            <div class="table" tabindex="0" role="region" [attr.aria-label]="panel().title">
              <table>
                <thead><tr>@for (f of r.fields; track f) { <th scope="col">{{ f }}</th> }</tr></thead>
                <tbody>
                  @for (row of r.rows.slice(0, 200); track $index) {
                    <tr>@for (f of r.fields; track f) { <td [class.num]="isNum(row[f])">{{ cell(row[f]) }}</td> }</tr>
                  }
                </tbody>
              </table>
              @if (r.rows.length > 200) { <p class="muted small">{{ 'dashboards.firstRows' | translate: { count: 200 } }}</p> }
            </div>
          } @else if (panel().viz.type === 'kpi') {
            <div class="kpi">
              <span class="value pvx-num">{{ kpi() }}</span>
              @if (panel().viz.unit) { <span class="unit">{{ panel().viz.unit }}</span> }
            </div>
            <p class="muted small">{{ valueField() }}</p>
          } @else {
            @if (tooMany()) {
              <p class="hint" role="note">{{ 'dashboards.tooManyLabels' | translate: { count: r.rows.length } }}</p>
            }
            <div echarts class="chart" [options]="chart()" [autoResize]="true" role="img" [attr.aria-label]="panel().title"></div>
          }
        }
      </div>

      @if (result() && !editing()) {
        <footer class="muted small pvx-num">{{ 'dashboards.updated' | translate: { time: ranAt() } }}</footer>
      }
    </article>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .panel { height: 100%; display: flex; flex-direction: column; background: var(--pvx-bg-card); border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); overflow: hidden; }
    .panel.editing { border-style: dashed; border-color: var(--pvx-border-strong); }
    header { display: flex; align-items: center; gap: 4px; padding: 10px 12px 4px 16px; }
    h3 { flex: 1; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .icon { display: inline-flex; padding: 6px; border: 0; border-radius: 6px; background: none; color: var(--pvx-text-muted); cursor: pointer; }
    .icon:hover { background: var(--pvx-bg-sunken); color: var(--pvx-text); }
    .body { flex: 1; min-height: 0; padding: 4px 16px 8px; display: flex; flex-direction: column; }
    .chart { flex: 1; min-height: 120px; width: 100%; }
    .kpi { display: flex; align-items: baseline; gap: 6px; margin-top: auto; }
    .kpi .value { font-size: clamp(28px, 4vw, 44px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
    .kpi .unit { font-size: 18px; color: var(--pvx-text-muted); font-weight: 600; }
    .kpi + .muted { margin-bottom: auto; }
    .text { white-space: pre-wrap; font-size: 14px; line-height: 1.6; max-width: 70ch; }
    .table { flex: 1; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { position: sticky; top: 0; background: var(--pvx-bg-sunken); text-align: left; font-weight: 600; color: var(--pvx-text-muted); padding: 6px 10px; white-space: nowrap; }
    td { padding: 6px 10px; border-top: 1px solid var(--pvx-border); white-space: nowrap; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: var(--pvx-text-muted); }
    .hint { font-size: 12px; color: var(--pvx-warn-text); background: var(--pvx-warn-bg); border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; }
    .small { font-size: 12px; }
    footer { padding: 0 16px 10px; }
    .err { color: var(--pvx-danger); font-size: 13px; }
    .skeleton { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .skeleton span { height: 12px; border-radius: 6px; background: var(--pvx-bg-sunken); animation: pulse 1.2s ease-in-out infinite; }
    .skeleton span:nth-child(2) { width: 80%; } .skeleton span:nth-child(3) { width: 60%; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .skeleton span { animation: none; } }
  `],
})
export class PanelComponent implements OnChanges {
  readonly dashboardId = input.required<string>();
  readonly panel = input.required<DashboardPanel>();
  readonly editing = input(false);
  readonly asRole = input<string | null>(null);
  /** Bumped by the dashboard to reload every panel. */
  readonly refreshKey = input(0);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly api = inject(DashboardsApiService);
  private readonly theme = inject(ThemeService);
  private readonly t = inject(TranslateService);
  private readonly otherLabel = this.t.instant('dashboards.other');
  readonly result = signal<PanelResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly asTable = signal(false);
  private sub: Subscription | null = null;
  private lastKey = '';

  ngOnChanges() {
    const p = this.panel();
    // Reload only when what is shown changes, not on every move or resize.
    const key = `${this.dashboardId()}|${p.id}|${p.queryId}|${this.asRole()}|${this.refreshKey()}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.load();
  }

  private load() {
    const p = this.panel();
    this.sub?.unsubscribe();
    if (p.viz.type === 'text' || !p.queryId) return;
    this.loading.set(true);
    this.error.set('');
    this.sub = this.api.panelData(this.dashboardId(), p.id, this.asRole()).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.result.set(null);
        this.loading.set(false);
        this.error.set(errorText(e));
      },
    });
  }

  cell(v: unknown) { return show(v); }
  isNum(v: unknown) { return numeric(v); }

  readonly numberFields = computed(() => {
    const r = this.result();
    if (!r) return [];
    const sample = r.rows.slice(0, 50);
    return r.fields.filter((f) => sample.length > 0 && sample.every((row) => row[f] === null || row[f] === undefined || numeric(row[f])));
  });
  readonly valueField = computed(() => {
    const want = this.panel().viz.value;
    if (want && this.numberFields().includes(want)) return want;
    return this.numberFields()[this.numberFields().length - 1] ?? '';
  });
  readonly labelField = computed(() => {
    const r = this.result();
    const want = this.panel().viz.label;
    if (!r) return '';
    if (want && r.fields.includes(want)) return want;
    return r.fields.find((f) => !this.numberFields().includes(f)) ?? r.fields[0] ?? '';
  });

  /** A KPI shows the value of its first row, which is what a count or a total returns. */
  readonly kpi = computed(() => {
    const r = this.result();
    if (!r || !r.rows.length || !this.valueField()) return '—';
    return show(r.rows[0][this.valueField()]);
  });

  readonly ranAt = computed(() => {
    const r = this.result();
    if (!r) return '';
    const d = new Date(r.ranAt);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  });

  /** Raw rows charted one label each: readable only up to a point, so the editor is told to summarise. */
  readonly tooMany = computed(() => {
    const n = this.result()?.rows.length ?? 0;
    return this.panel().viz.type === 'pie' ? n > PIE_SLICES : n > 60;
  });

  readonly chart = computed<EChartsCoreOption>(() => {
    const r = this.result();
    const dark = this.theme.theme() === 'dark';
    const text = dark ? '#CBD5E1' : '#475569';
    const grid = dark ? '#334155' : '#E2E8F0';
    const rows = (r?.rows ?? []).slice(0, 500);
    const labels = rows.map((row) => show(row[this.labelField()]));
    const values = rows.map((row) => Number(row[this.valueField()] ?? 0));
    const type = this.panel().viz.type;
    if (type === 'pie') {
      // The largest slices, then everything else as one "Other" slice, so the pie stays readable.
      const pairs = labels.map((name, i) => ({ name, value: values[i] })).sort((a, b) => b.value - a.value);
      const top = pairs.slice(0, PIE_SLICES);
      const rest = pairs.slice(PIE_SLICES).reduce((sum, p) => sum + p.value, 0);
      if (pairs.length > PIE_SLICES) top.push({ name: this.otherLabel, value: rest });
      return {
        color: SERIES,
        tooltip: { trigger: 'item', valueFormatter: (v: unknown) => inr.format(Number(v)) },
        legend: { type: 'scroll', bottom: 0, textStyle: { color: text } },
        series: [{ type: 'pie', radius: ['42%', '70%'], data: top, label: { color: text, overflow: 'truncate', width: 120 } }],
      };
    }
    return {
      color: SERIES,
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => inr.format(Number(v)) },
      grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: text, hideOverlap: true, overflow: 'truncate', width: 90 }, axisLine: { lineStyle: { color: grid } } },
      yAxis: { type: 'value', axisLabel: { color: text, formatter: (v: number) => inr.format(v) }, splitLine: { lineStyle: { color: grid } } },
      series: [{ type: type === 'line' ? 'line' : 'bar', name: this.valueField(), data: values, barMaxWidth: 40 }],
    };
  });
}
