/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import type { ColumnType } from '@paarvix/shared';

// Western (1,250,000) and Indian (1,25,000) grouping, optional rupee sign and sign.
const NUMBER = /^[-+]?(?:₹\s*)?(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d+)(?:\.\d+)?$/;
const LEADING_ZERO = /^0\d/; // after the sign: 00123, 007.5
const LONG_DIGITS = /^\d{10,}$/; // phone numbers, account and ID numbers
const MAX_SIGNIFICANT_DIGITS = 15; // beyond this a double silently rounds
const DMY = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const BOOLEAN = /^(true|false)$/i;

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** A real date that Postgres and Excel both hold. Excel stops at year 9999, so anything else is a corrupt cell. */
export function validDate(d: Date): boolean {
  const y = d.getUTCFullYear();
  return !Number.isNaN(d.getTime()) && y >= 1000 && y <= 9999;
}

function utcDate(y: number, m: number, d: number): Date | null {
  if (y < 1000) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** Day first: 01-02-2026 is 1 February. */
function parseDate(s: string): Date | null {
  let m = DMY.exec(s);
  if (m) return utcDate(+m[3], +m[2], +m[1]);
  m = ISO.exec(s);
  return m ? utcDate(+m[1], +m[2], +m[3]) : null;
}

function parseNumber(s: string): number {
  return Number(s.replace(/[₹,\s]/g, ''));
}

function significantDigits(numeric: string): number {
  const plain = numeric.replace(/,/g, '');
  const trimmed = plain.includes('.') ? plain.replace(/0+$/, '') : plain;
  return trimmed.replace('.', '').replace(/^0+/, '').length;
}

/** The type one value suggests. Identifier-like values force `text` so they keep leading zeros and all digits. */
function kind(v: unknown): ColumnType {
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) >= 1e9 ? 'text' : 'number';
  if (v instanceof Date) return 'date';
  if (typeof v !== 'string') return 'text';
  const s = v.trim();
  if (BOOLEAN.test(s)) return 'boolean';
  if (parseDate(s)) return 'date';
  if (!NUMBER.test(s)) return 'text';
  const unsigned = s.replace(/^[-+]?(?:₹\s*)?/, '');
  if (LEADING_ZERO.test(unsigned) || LONG_DIGITS.test(unsigned)) return 'text';
  return significantDigits(unsigned) > MAX_SIGNIFICANT_DIGITS ? 'text' : 'number';
}

/** Feed it every value of a column. Blanks are ignored and any mix of types is `text`. */
export class ColumnTracker {
  private readonly seen = new Set<ColumnType>();

  add(value: unknown): void {
    if (isBlank(value)) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    if (value instanceof Date && !validDate(value)) return;
    this.seen.add(kind(value));
  }

  type(): ColumnType {
    return this.seen.size === 1 ? [...this.seen][0] : 'text';
  }
}

/** Converts a raw cell to the value stored for a column of this type. `null` means empty. */
export function normalise(value: unknown, type: ColumnType): string | number | boolean | Date | null {
  if (isBlank(value) || (value instanceof Date && !validDate(value))) return null;
  switch (type) {
    case 'number': {
      const n = typeof value === 'number' ? value : parseNumber(String(value));
      return Number.isFinite(n) ? n : null;
    }
    case 'date':
      if (value instanceof Date) return validDate(value) ? value : null;
      return parseDate(String(value).trim());
    case 'boolean':
      return typeof value === 'boolean' ? value : String(value).trim().toLowerCase() === 'true';
    default:
      // Postgres text cannot hold NUL bytes.
      if (value instanceof Date) return validDate(value) ? value.toISOString() : null;
      return String(value).replace(/\u0000/g, '');
  }
}
