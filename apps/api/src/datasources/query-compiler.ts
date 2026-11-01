/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import type { ColumnSchema, Filter, QueryResult, QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';

export type Dialect = 'postgres' | 'mysql';

/** Row cap and time limit shared by every connector. Queries fetch one row past the cap to detect truncation. */
export const MAX_ROWS = 10000;
export const QUERY_TIMEOUT_MS = 30000;

export interface CompiledQuery {
  text: string;
  values: unknown[];
  labels: string[];
  /** The effective row cap. The SQL fetches one more row than this. */
  limit: number;
}

// Maps, not objects: a hostile key like 'constructor' must not resolve through the prototype chain.
const COMPARE = new Map([
  ['eq', '='],
  ['ne', '<>'],
  ['gt', '>'],
  ['gte', '>='],
  ['lt', '<'],
  ['lte', '<='],
]);
const AGGREGATES = new Map([
  ['count', 'COUNT'],
  ['sum', 'SUM'],
  ['avg', 'AVG'],
  ['min', 'MIN'],
  ['max', 'MAX'],
]);

const missing = (name: string) => new BadRequestException(`column no longer exists: ${String(name).slice(0, 64)}`);

/** Rejects a malformed request body before any database work. */
export function assertSpecShape(spec: unknown): asserts spec is QuerySpec {
  const s = spec as Record<string, unknown> | null | undefined;
  const lists = ['columns', 'filters', 'groupBy', 'aggregates', 'orderBy'];
  if (typeof s?.table !== 'string' || lists.some((k) => s[k] !== undefined && !Array.isArray(s[k]))) {
    throw new BadRequestException('This query is not valid');
  }
}

/**
 * The safety boundary for data queries. Names come only from the discovered schema,
 * identifiers are quoted, and every value is a bound parameter.
 */
export function compileQuery(
  spec: QuerySpec,
  table: TableSchema,
  dialect: Dialect,
  ctx: SecurityContext,
): CompiledQuery {
  if (spec.table !== table.name) throw missing(spec.table);

  const q = (name: string) => (dialect === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`);
  const values: unknown[] = [];
  const bind = (v: unknown) => {
    values.push(v);
    return dialect === 'mysql' ? '?' : `$${values.length}`;
  };
  const col = (name: string): ColumnSchema => {
    const c = table.columns.find((x) => x.name === name);
    if (!c) throw missing(name);
    return c;
  };
  const ref = (name: string) => q(col(name).storageName ?? name);

  const labels: string[] = [];
  const select: string[] = [];
  const add = (expr: string, label: string) => {
    if (typeof label !== 'string' || !label || labels.includes(label)) {
      throw new BadRequestException('each output column needs a unique, non-empty name');
    }
    select.push(`${expr} AS ${q(`f${labels.length}`)}`);
    labels.push(label);
  };
  const aliasOf = new Map<string, string>();

  if (spec.aggregates?.length || spec.groupBy?.length) {
    for (const g of spec.groupBy ?? []) add(ref(g), g);
    for (const a of spec.aggregates ?? []) {
      const fn = AGGREGATES.get(a.fn);
      if (!fn) throw new BadRequestException(`unknown aggregate: ${String(a.fn).slice(0, 64)}`);
      let expr: string;
      if (!a.column) {
        if (a.fn !== 'count') throw new BadRequestException(`${a.fn} needs a column`);
        expr = 'COUNT(*)';
      } else {
        if ((a.fn === 'sum' || a.fn === 'avg') && col(a.column).type !== 'number') {
          throw new BadRequestException(`${a.fn} needs a number column`);
        }
        expr = `${fn}(${ref(a.column)})`;
      }
      aliasOf.set(a.as, q(`f${labels.length}`));
      add(expr, a.as);
    }
  } else {
    for (const c of spec.columns?.length ? spec.columns : table.columns.map((x) => x.name)) add(ref(c), c);
  }

  const where = [...(spec.filters ?? []), ...ctx.rowFilters].map((f) => condition(f, ref, bind, dialect));

  const from = table.storageName ? table.storageName.split('.').map(q).join('.') : q(table.name);
  let text = `SELECT ${select.join(', ')} FROM ${from}`;
  if (where.length) text += ` WHERE ${where.join(' AND ')}`;
  if (spec.groupBy?.length) text += ` GROUP BY ${spec.groupBy.map(ref).join(', ')}`;
  if (spec.orderBy?.length) {
    const order = spec.orderBy.map((o) => `${aliasOf.get(o.column) ?? ref(o.column)} ${o.dir === 'desc' ? 'DESC' : 'ASC'}`);
    text += ` ORDER BY ${order.join(', ')}`;
  }
  const limit = Math.min(Math.max(Math.floor(Number(spec.limit ?? MAX_ROWS)) || MAX_ROWS, 1), MAX_ROWS);
  text += ` LIMIT ${limit + 1}`; // one extra row tells the caller the result was truncated

  return { text, values, labels, limit };
}

function condition(f: Filter, ref: (n: string) => string, bind: (v: unknown) => string, dialect: Dialect): string {
  const c = ref(f.column);
  if (f.op === 'isNull') return `${c} IS NULL`;
  if (f.op === 'in') {
    if (!Array.isArray(f.value) || !f.value.length) throw new BadRequestException('in needs a list of values');
    return `${c} IN (${f.value.map((v) => bind(scalar(v))).join(', ')})`;
  }
  if (f.op === 'contains') {
    const escaped = String(scalar(f.value)).replace(/[\\%_]/g, '\\$&');
    return `${c} ${dialect === 'postgres' ? 'ILIKE' : 'LIKE'} ${bind(`%${escaped}%`)}`;
  }
  const op = COMPARE.get(f.op);
  if (!op) throw new BadRequestException(`unknown filter: ${String(f.op).slice(0, 64)}`);
  return `${c} ${op} ${bind(scalar(f.value))}`;
}

/** Only plain scalars are bound: objects and arrays can expand into identifiers in some drivers, null needs isNull. */
function scalar(v: unknown): string | number | boolean {
  if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return v;
  throw new BadRequestException('filter values must be text, numbers or true/false');
}

/** Restores display names for the generated aliases f0, f1, ... */
export function labelRows(rows: Record<string, unknown>[], labels: string[]): Record<string, unknown>[] {
  return rows.map((r) => Object.fromEntries(labels.map((l, i) => [l, r[`f${i}`]])));
}

/** Trims the extra row and reports `truncated`, so every connector applies the cap the same way. */
export function trimRows<T>(rows: T[], limit = MAX_ROWS): { rows: T[]; truncated: boolean } {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

export function toQueryResult(rows: Record<string, unknown>[], compiled: CompiledQuery): QueryResult {
  const { rows: kept, truncated } = trimRows(rows, compiled.limit);
  return { fields: compiled.labels, rows: labelRows(kept, compiled.labels), truncated };
}
