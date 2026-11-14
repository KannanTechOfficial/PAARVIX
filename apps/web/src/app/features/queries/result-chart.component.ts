/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
// Core import with only the charts used here, so the full ECharts bundle is not pulled in.
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { ThemeService } from '../../core/services/theme.service';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type ChartKind = 'bar' | 'line' | 'pie';

/** Colour-blind-safe series colours built from the brand: blue, teal, orange, then neutrals. */
const SERIES = ['#1E3A8A', '#0D9488', '#EA580C', '#7C3AED', '#64748B', '#0284C7'];

const isNumeric = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));

/** Charts a result. The table view stays one click away, as the accessible alternative. */
@Component({
  selector: 'pvx-result-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    @if (numberFields().length === 0) {
      <p class="pvx-note info">{{ 'queries.chartNeedsNumber' | translate }}</p>
    } @else {
      <div class="controls">
        <div class="kinds" role="group" [attr.aria-label]="'queries.chartType' | translate">
          @for (k of kinds; track k) {
            <button type="button" class="pvx-btn small" [class.primary]="kind() === k" (click)="kind.set(k)" [attr.aria-pressed]="kind() === k">
              {{ 'queries.charts.' + k | translate }}
            </button>
          }
        </div>
        <label class="pvx-field inline"><span>{{ 'queries.chartLabel' | translate }}</span>
          <select class="pvx-select" [ngModel]="labelField()" (ngModelChange)="label.set($event)">
            @for (f of fields(); track f) { <option [value]="f">{{ f }}</option> }
          </select></label>
        <label class="pvx-field inline"><span>{{ 'queries.chartValue' | translate }}</span>
          <select class="pvx-select" [ngModel]="valueField()" (ngModelChange)="value.set($event)">
            @for (f of numberFields(); track f) { <option [value]="f">{{ f }}</option> }
          </select></label>
      </div>
      @if (rows().length > maxPoints) {
        <p class="note">{{ 'queries.chartCapped' | translate: { count: maxPoints } }}</p>
      }
      <div echarts class="chart" [options]="options()" [autoResize]="true" role="img" [attr.aria-label]="ariaLabel()"></div>
    }
  `,
  styles: [`
    .controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; margin-bottom: 12px; }
    .kinds { display: flex; gap: 6px; }
    .inline { min-width: 180px; }
    .chart { height: 360px; width: 100%; }
    .note { font-size: 13px; color: var(--pvx-text-muted); margin-bottom: 8px; }
  `],
})
export class ResultChartComponent {
  readonly fields = input<string[]>([]);
  readonly rows = input<Record<string, unknown>[]>([]);
  readonly kinds: ChartKind[] = ['bar', 'line', 'pie'];
  readonly maxPoints = 500;
  readonly kind = signal<ChartKind>('bar');
  readonly label = signal<string | null>(null);
  readonly value = signal<string | null>(null);
  private readonly theme = inject(ThemeService);

  readonly numberFields = computed(() => {
    const sample = this.rows().slice(0, 50);
    return this.fields().filter((f) => sample.length > 0 && sample.every((r) => r[f] === null || r[f] === undefined || isNumeric(r[f])));
  });

  /** Defaults: the first text column as labels, the first number column as values. */
  readonly labelField = computed(() => {
    const chosen = this.label();
    if (chosen && this.fields().includes(chosen)) return chosen;
    return this.fields().find((f) => !this.numberFields().includes(f)) ?? this.fields()[0] ?? '';
  });
  readonly valueField = computed(() => {
    const chosen = this.value();
    if (chosen && this.numberFields().includes(chosen)) return chosen;
    return this.numberFields().find((f) => f !== this.labelField()) ?? this.numberFields()[0] ?? '';
  });

  readonly ariaLabel = computed(() => `${this.kind()} chart of ${this.valueField()} by ${this.labelField()}`);

  readonly options = computed<EChartsCoreOption>(() => {
    const dark = this.theme.theme() === 'dark';
    const text = dark ? '#CBD5E1' : '#475569';
    const grid = dark ? '#334155' : '#E2E8F0';
    const data = this.rows().slice(0, this.maxPoints);
    const labels = data.map((r) => String(r[this.labelField()] ?? '—'));
    const values = data.map((r) => Number(r[this.valueField()] ?? 0));
    const fmt = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v);

    if (this.kind() === 'pie') {
      return {
        color: SERIES,
        tooltip: { trigger: 'item', valueFormatter: (v: unknown) => fmt(Number(v)) },
        legend: { type: 'scroll', bottom: 0, textStyle: { color: text } },
        series: [{ type: 'pie', radius: ['40%', '70%'], data: labels.map((name, i) => ({ name, value: values[i] })), label: { color: text } }],
      };
    }
    return {
      color: SERIES,
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => fmt(Number(v)) },
      grid: { left: 12, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: text, hideOverlap: true }, axisLine: { lineStyle: { color: grid } } },
      yAxis: { type: 'value', axisLabel: { color: text, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: grid } } },
      series: [{ type: this.kind(), name: this.valueField(), data: values, smooth: false, barMaxWidth: 48 }],
    };
  });
}
