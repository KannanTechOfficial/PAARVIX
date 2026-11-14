/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { DashboardPanel, PanelRole } from '@paarvix/shared';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { Subscription } from 'rxjs';
import { errorText } from '../../../core/services/admin-api.service';
import { PanelDataService, type PanelData } from '../../../core/services/panel-data.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../../../core/ui/icon.component';
import { type ChartKind, chartOptions } from '../../../core/charts/chart-theme';
import { clockTime, formatCell, formatCompact, isIsoDate, isNumeric, withUnit } from '../../../core/charts/format';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type ViewerLayout = 'desktop' | 'phone' | 'wall';

/** A panel with no frame: its role decides how it is drawn, the layout decides how large. */
@Component({
  selector: 'pvx-viewer-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, NgxEchartsDirective, IconComponent],
  providers: [provideEchartsCore({ echarts })],
  host: { '[class]': '"vp role-" + role() + " lay-" + layout()' },
  templateUrl: './viewer-panel.component.html',
  styleUrl: './viewer-panel.component.scss',
})
export class ViewerPanelComponent implements OnChanges {
  readonly dashboardId = input.required<string>();
  readonly panel = input.required<DashboardPanel>();
  readonly layout = input<ViewerLayout>('desktop');
  readonly asRole = input<string | null>(null);
  readonly refreshKey = input(0);
  /** Phone: a detail table opens full screen in a sheet. */
  readonly openDetail = output<{ panel: DashboardPanel; data: PanelData }>();
  readonly loaded = output<PanelData>();

  private readonly data = inject(PanelDataService);
  private readonly theme = inject(ThemeService);
  private readonly t = inject(TranslateService);

  readonly result = signal<PanelData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly asTable = signal(false);
  /** While a headline counts up on first load, the value being shown. */
  private readonly counting = signal<number | null>(null);
  private counted = false;
  private sub: Subscription | null = null;
  private lastKey = '';

  readonly role = computed<PanelRole>(() => this.panel().role ?? 'supporting');

  ngOnChanges() {
    const p = this.panel();
    const key = `${this.dashboardId()}|${p.id}|${p.queryId}|${this.asRole()}|${this.refreshKey()}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.sub?.unsubscribe();
    if (p.viz.type === 'text' || !p.queryId) return;
    this.loading.set(!this.result());
    this.error.set('');
    this.sub = this.data.load(this.dashboardId(), p.id, this.asRole()).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
        this.loaded.emit(r);
        if (!this.counted) this.countUp();
        this.counted = true;
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorText(e));
      },
    });
  }

  // ---------- columns ----------
  readonly numberFields = computed(() => {
    const r = this.result();
    if (!r) return [];
    const sample = r.rows.slice(0, 50);
    return r.fields.filter((f) => sample.length > 0 && sample.every((row) => row[f] === null || row[f] === undefined || isNumeric(row[f])));
  });
  readonly valueField = computed(() => {
    const want = this.panel().viz.value;
    if (want && this.numberFields().includes(want)) return want;
    return this.numberFields()[this.numberFields().length - 1] ?? '';
  });
  readonly labelField = computed(() => {
    const r = this.result();
    if (!r) return '';
    const want = this.panel().viz.label;
    if (want && r.fields.includes(want)) return want;
    return r.fields.find((f) => !this.numberFields().includes(f)) ?? r.fields[0] ?? '';
  });

  // ---------- headline ----------
  /**
   * A headline from a one-row query shows that value. From a query that returns a series
   * (for example Count by month, oldest first) it shows the latest value, the change from
   * the one before, and the whole series as a trend line.
   */
  readonly headline = computed(() => {
    const r = this.result();
    const f = this.valueField();
    if (!r || !r.rows.length || !f) return null;
    const series = r.rows.map((row) => Number(row[f])).filter((v) => Number.isFinite(v));
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const unit = this.panel().viz.unit;
    const delta = previous === null ? null : latest - previous;
    const pct = previous ? (delta! / Math.abs(previous)) * 100 : null;
    const lastLabel = series.length > 1 ? r.rows[r.rows.length - 2][this.labelField()] : null;
    return {
      value: withUnit(formatCompact(latest), unit),
      exact: withUnit(formatCell(latest), unit),
      delta,
      deltaText: delta === null ? '' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatCompact(Math.abs(delta))}${pct !== null && Number.isFinite(pct) ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}`,
      since: lastLabel === null || lastLabel === undefined ? '' : isIsoDate(lastLabel) ? new Date(String(lastLabel)).toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : formatCell(lastLabel),
      spark: series.length > 2 ? this.sparkPath(series.slice(-24)) : null,
      // Green when the change is good news, red when bad; neutral unless the author said which way is good.
      tone: delta === null || delta === 0 || !this.panel().viz.goodWhen ? 'neutral' : (delta > 0) === (this.panel().viz.goodWhen === 'up') ? 'good' : 'bad',
    };
  });

  /**
   * The one authored moment: a headline counts up to its value the first time it loads.
   * Short, eased to a stop, and skipped entirely when reduced motion is asked for.
   */
  private countUp() {
    if (this.role() !== 'headline' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = this.result();
    const f = this.valueField();
    const target = r && f && r.rows.length ? Number(r.rows[r.rows.length - 1][f]) : NaN;
    if (!Number.isFinite(target) || target === 0) return;
    const start = performance.now(), duration = 700;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(2, -10 * t); // exponential ease-out
      this.counting.set(t >= 1 ? null : target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  readonly displayValue = computed(() => {
    const h = this.headline();
    const n = this.counting();
    if (!h) return '';
    if (n === null) return h.value;
    const target = Number(this.result()!.rows[this.result()!.rows.length - 1][this.valueField()]);
    // Count in whole numbers when the final value is whole, so digits do not flicker.
    return withUnit(formatCompact(Number.isInteger(target) && Math.abs(target) < 1e5 ? Math.round(n) : n), this.panel().viz.unit);
  });

  /** A small trend line as an SVG path, 100 by 28 units. */
  private sparkPath(values: number[]): { line: string; area: string } {
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - ((v - min) / span) * 24]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L100,28 L0,28 Z` };
  }

  // ---------- charts ----------
  readonly chartKind = computed<ChartKind>(() => {
    const type = this.panel().viz.type;
    return type === 'line' || type === 'pie' ? type : 'bar';
  });

  readonly tooMany = computed(() => {
    const n = this.result()?.rows.length ?? 0;
    return this.chartKind() === 'pie' ? n > 9 : n > 60;
  });

  readonly chart = computed<EChartsCoreOption>(() => {
    const r = this.result();
    const rows = (r?.rows ?? []).slice(0, 500);
    return chartOptions({
      kind: this.chartKind(),
      labels: rows.map((row) => row[this.labelField()]),
      values: rows.map((row) => Number(row[this.valueField()] ?? 0)),
      seriesName: this.valueField(),
      dark: this.layout() === 'wall' || this.theme.theme() === 'dark',
      size: this.layout() === 'wall' ? 'wall' : this.layout() === 'phone' || this.role() === 'supporting' ? 'compact' : 'regular',
      otherLabel: this.t.instant('dashboards.other'),
    });
  });

  // ---------- tables ----------
  readonly previewRows = computed(() => {
    const r = this.result();
    if (!r) return [];
    return r.rows.slice(0, this.layout() === 'phone' ? 5 : 200);
  });

  cell(v: unknown) {
    return formatCell(v);
  }

  isNum(v: unknown) {
    return isNumeric(v);
  }

  readonly updated = computed(() => {
    const r = this.result();
    return r ? clockTime(new Date(r.ranAt)) : '';
  });
}
