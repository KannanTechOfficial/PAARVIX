/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/** One place for how Paarvix writes numbers and dates: Indian grouping, lakh and crore, DD-MM-YYYY. */

const full = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isNumeric = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));

export const isIsoDate = (v: unknown): boolean => typeof v === 'string' && ISO_DATE.test(v);

/** 12,34,567.89 */
export function formatNumber(v: number): string {
  return full.format(v);
}

/** Headline form: 2.87 Cr, 34.5 L, 12,345. Below one lakh the full number is clearer. */
export function formatCompact(v: number): string {
  const abs = Math.abs(v);
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e7) return `${trim(v / 1e7)} Cr`;
  if (abs >= 1e5) return `${trim(v / 1e5)} L`;
  return full.format(Math.round(v * 100) / 100);
}

/** DD-MM-YYYY, or "Nov 2026" for the first of a month (how monthly data is stored). */
export function formatDate(v: string, monthly = false): string {
  const [y, m, d] = v.split('T')[0].split('-');
  if (monthly || (d === '01' && v.includes('T00:00:00'))) return `${MONTHS[Number(m) - 1]} ${y}`;
  return `${d}-${m}-${y}`;
}

/** Any cell value, for tables and labels. */
export function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (isNumeric(v)) return formatNumber(Number(v));
  if (isIsoDate(v)) return formatDate(v as string);
  return String(v);
}

/** A value with its unit: "₹2.87 Cr", "82.4%", "71 days". */
export function withUnit(text: string, unit?: string): string {
  if (!unit) return text;
  if (unit === '₹' || unit === '$') return `${unit}${text}`;
  if (unit === '%') return `${text}%`;
  return `${text} ${unit}`;
}

export function clockTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
