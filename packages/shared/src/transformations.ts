/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ThresholdConfig, UnitType } from './dataframe';

export type VectorReducerOp = 'avg' | 'min' | 'max' | 'sum' | 'last' | 'first' | 'count' | 'delta';

/**
 * Fast vector reduction loop across an array of numbers
 */
export function reduceVector(values: number[], op: VectorReducerOp): number {
  const len = values.length;
  if (len === 0) return 0;

  switch (op) {
    case 'first':
      return values[0];
    case 'last':
      return values[len - 1];
    case 'count':
      return len;
    case 'delta':
      return values[len - 1] - values[0];
    case 'sum': {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += values[i];
      return sum;
    }
    case 'avg': {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += values[i];
      return sum / len;
    }
    case 'min': {
      let min = values[0];
      for (let i = 1; i < len; i++) {
        if (values[i] < min) min = values[i];
      }
      return min;
    }
    case 'max': {
      let max = values[0];
      for (let i = 1; i < len; i++) {
        if (values[i] > max) max = values[i];
      }
      return max;
    }
    default:
      return values[len - 1];
  }
}

/**
 * Determines threshold color for a numeric value
 */
export function getColorForValue(
  value: number,
  thresholds?: ThresholdConfig,
  defaultColor = '#14B8A6',
): string {
  if (!thresholds || !thresholds.steps || thresholds.steps.length === 0) {
    return defaultColor;
  }

  // Sorted ascending by value
  const steps = [...thresholds.steps].sort((a, b) => a.value - b.value);
  let activeColor = steps[0].color;

  for (const step of steps) {
    if (value >= step.value) {
      activeColor = step.color;
    } else {
      break;
    }
  }

  return activeColor;
}

/**
 * Formats numeric values according to units (Percent, Bytes, Bytes/sec, Ops, ms, INR)
 */
export function formatUnitValue(
  value: number,
  unit?: UnitType,
  decimals = 1,
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  switch (unit) {
    case 'percent':
      return `${value.toFixed(decimals)}%`;
    case 'percent_unit':
      return `${(value * 100).toFixed(decimals)}%`;
    case 'bytes':
      return formatBytes(value, decimals);
    case 'bytes_sec':
      return `${formatBytes(value, decimals)}/s`;
    case 'ms':
      if (value >= 1000) {
        return `${(value / 1000).toFixed(decimals)}s`;
      }
      return `${value.toFixed(decimals)}ms`;
    case 's':
      return `${value.toFixed(decimals)}s`;
    case 'ops':
      return `${formatCompactNumber(value, decimals)} ops/s`;
    case 'currency_inr':
      return `₹${formatIndianCurrency(value)}`;
    case 'short':
    default:
      return formatCompactNumber(value, decimals);
  }
}

function formatBytes(bytes: number, decimals: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(decimals))} ${sizes[safeI]}`;
}

function formatCompactNumber(num: number, decimals: number): string {
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

function formatIndianCurrency(num: number): string {
  const parts = num.toFixed(0).split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherNumbers = parts[0].substring(0, parts[0].length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
}

