/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import type { EChartsCoreOption } from 'echarts/core';
import { formatCell, formatCompact, formatNumber, isIsoDate } from './format';

/**
 * Series colours in an order that stays distinguishable for the common forms of colour blindness:
 * brand blue, teal, orange, then violet, slate and sky.
 */
export const SERIES_COLOURS = ['#1E3A8A', '#0D9488', '#EA580C', '#7C3AED', '#64748B', '#0284C7'];
export const SERIES_COLOURS_DARK = ['#7EA2F2', '#2DD4BF', '#FB923C', '#A78BFA', '#94A3B8', '#38BDF8'];

export type ChartKind = 'bar' | 'line' | 'pie';
export type ChartSize = 'compact' | 'regular' | 'wall';

export interface ChartInput {
  kind: ChartKind;
  labels: unknown[];
  values: number[];
  seriesName: string;
  dark: boolean;
  size: ChartSize;
  /** Pie: largest slices, the rest folded into one. */
  maxSlices?: number;
  otherLabel?: string;
}

/** The one chart look used across Paarvix: quiet grid, readable labels, direct values, no 3D. */
export function chartOptions(c: ChartInput): EChartsCoreOption {
  const text = c.dark ? '#CBD5E1' : '#475569';
  const grid = c.dark ? 'rgba(148,163,184,.18)' : '#E8EDF3';
  const colours = c.dark ? SERIES_COLOURS_DARK : SERIES_COLOURS;
  const font = c.size === 'wall' ? 22 : c.size === 'compact' ? 11 : 12;
  const monthly = c.labels.length > 1 && c.labels.every((l) => isIsoDate(l) && String(l).slice(8, 10) === '01');
  // Monthly data reads as "Jul 26, Aug 26" rather than five dates that all start with 01.
  const labels = c.labels.map((l) => (monthly ? new Date(String(l)).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : formatCell(l)));
  const textStyle = { color: text, fontSize: font, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" };
  const tooltip = {
    backgroundColor: c.dark ? '#0F172A' : '#FFFFFF',
    borderColor: c.dark ? '#334155' : '#E2E8F0',
    textStyle: { color: c.dark ? '#F1F5F9' : '#0F172A', fontSize: 13 },
    valueFormatter: (v: unknown) => formatNumber(Number(v)),
  };

  if (c.kind === 'pie') {
    const max = c.maxSlices ?? 9;
    const pairs = labels.map((name, i) => ({ name, value: c.values[i] })).sort((a, b) => b.value - a.value);
    const data = pairs.slice(0, max);
    if (pairs.length > max) data.push({ name: c.otherLabel ?? 'Other', value: pairs.slice(max).reduce((s, p) => s + p.value, 0) });
    return {
      color: colours,
      textStyle,
      tooltip: { ...tooltip, trigger: 'item' },
      legend: c.size === 'compact' ? { show: false } : { type: 'scroll', bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle },
      series: [{
        type: 'pie',
        radius: c.size === 'compact' ? ['46%', '74%'] : ['50%', '72%'],
        center: ['50%', c.size === 'compact' ? '50%' : '46%'],
        padAngle: 1,
        itemStyle: { borderRadius: 4, borderColor: c.dark ? '#0B1220' : '#FFFFFF', borderWidth: 2 },
        label: { color: text, fontSize: font, formatter: '{b}\n{d}%', overflow: 'truncate', width: c.size === 'wall' ? 260 : 120 },
        labelLine: { lineStyle: { color: grid } },
        data,
      }],
    };
  }

  const many = labels.length > (c.size === 'compact' ? 6 : 12);
  return {
    color: colours,
    textStyle,
    tooltip: { ...tooltip, trigger: 'axis', axisPointer: { type: c.kind === 'bar' ? 'shadow' : 'line', shadowStyle: { color: c.dark ? 'rgba(148,163,184,.08)' : 'rgba(30,58,138,.05)' } } },
    grid: { left: 4, right: 12, top: c.kind === 'bar' && !many ? 28 : 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: grid } },
      axisLabel: { color: text, fontSize: font, hideOverlap: true, overflow: 'truncate', width: c.size === 'wall' ? 200 : 90 },
    },
    yAxis: {
      type: 'value',
      splitNumber: c.size === 'compact' ? 3 : 4,
      axisLabel: { color: text, fontSize: font, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { color: grid } },
    },
    series: [{
      type: c.kind,
      name: c.seriesName,
      data: c.values,
      barMaxWidth: c.size === 'wall' ? 96 : 44,
      itemStyle: { borderRadius: c.kind === 'bar' ? [4, 4, 0, 0] : 0 },
      smooth: c.kind === 'line' ? 0.25 : undefined,
      symbol: 'circle',
      symbolSize: c.size === 'wall' ? 12 : 6,
      lineStyle: c.kind === 'line' ? { width: c.size === 'wall' ? 5 : 2.5 } : undefined,
      areaStyle: c.kind === 'line' ? { opacity: c.dark ? 0.16 : 0.08 } : undefined,
      // Direct labels on a short bar chart, so nobody has to read the axis.
      label: c.kind === 'bar' && !many ? { show: true, position: 'top', color: text, fontSize: font, formatter: (p: { value: number }) => formatCompact(p.value) } : undefined,
    }],
  };
}
