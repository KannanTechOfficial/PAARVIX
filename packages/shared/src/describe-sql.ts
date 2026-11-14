/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import type { Filter, QuerySpec } from './query';

/**
 * Readable SQL for a builder query, using the names people see. For display only:
 * the server compiles and runs its own SQL from the QuerySpec, with every value bound.
 */
export function describeSql(spec: QuerySpec, dialect: 'postgres' | 'mysql' = 'postgres'): string {
  const q = (n: string) => (dialect === 'mysql' ? `\`${n.replace(/`/g, '``')}\`` : `"${n.replace(/"/g, '""')}"`);
  const lit = (v: unknown) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

  const select: string[] = [];
  if (spec.groupBy?.length || spec.aggregates?.length) {
    for (const g of spec.groupBy ?? []) select.push(q(g));
    for (const a of spec.aggregates ?? []) select.push(`${a.fn.toUpperCase()}(${a.column ? q(a.column) : '*'}) AS ${q(a.as)}`);
  } else {
    select.push(spec.columns?.length ? spec.columns.map(q).join(', ') : '*');
  }

  const cond = (f: Filter) => {
    const c = q(f.column);
    switch (f.op) {
      case 'isNull': return `${c} IS NULL`;
      case 'in': return `${c} IN (${(Array.isArray(f.value) ? f.value : []).map(lit).join(', ')})`;
      case 'contains': return `${c} ${dialect === 'postgres' ? 'ILIKE' : 'LIKE'} ${lit(`%${String(f.value)}%`)}`;
      default: {
        const op = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[f.op] ?? '=';
        return `${c} ${op} ${lit(f.value)}`;
      }
    }
  };

  const lines = [`SELECT ${select.join(',\n       ')}`, `FROM ${q(spec.table)}`];
  if (spec.filters?.length) lines.push(`WHERE ${spec.filters.map(cond).join('\n  AND ')}`);
  if (spec.groupBy?.length) lines.push(`GROUP BY ${spec.groupBy.map(q).join(', ')}`);
  if (spec.orderBy?.length) lines.push(`ORDER BY ${spec.orderBy.map((o) => `${q(o.column)} ${o.dir.toUpperCase()}`).join(', ')}`);
  if (spec.limit) lines.push(`LIMIT ${spec.limit}`);
  return lines.join('\n');
}
