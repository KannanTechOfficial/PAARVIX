/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import type { QuerySpec, SecurityContext, TableSchema } from '@paarvix/shared';
import { assertSpecShape, compileQuery, labelRows, toQueryResult } from './query-compiler';

const sales: TableSchema = {
  name: 'sales',
  columns: [
    { name: 'Amount', type: 'number' },
    { name: 'Region', type: 'text' },
  ],
};
const ctx: SecurityContext = { userId: 'u1', role: 'EDITOR', tenantId: null, rowFilters: [] };

describe('assertSpecShape', () => {
  it.each([[undefined], [null], [{}], [{ table: 5 }], [{ table: 'sales', filters: 'x' }], [{ table: 'sales', columns: {} }]])(
    'rejects %j',
    (spec) => expect(() => assertSpecShape(spec)).toThrow(BadRequestException),
  );

  it('accepts a valid spec', () => {
    expect(() => assertSpecShape({ table: 'sales', filters: [], limit: 50 })).not.toThrow();
  });
});

describe('compileQuery', () => {
  it('binds values and quotes names for each dialect', () => {
    const spec = { table: 'sales', filters: [{ column: 'Region', op: 'eq' as const, value: 'South' }] };
    expect(compileQuery(spec, sales, 'postgres', ctx).text).toContain('"Region" = $1');
    expect(compileQuery(spec, sales, 'mysql', ctx).text).toContain('`Region` = ?');
    expect(compileQuery(spec, sales, 'postgres', ctx).values[0]).toBe('South');
  });

  it('rejects unknown names', () => {
    expect(() =>
      compileQuery({ table: 'sales', columns: ['x"; DROP TABLE users;--'] }, sales, 'postgres', ctx),
    ).toThrow('column no longer exists');
    expect(() => compileQuery({ table: 'users' }, sales, 'postgres', ctx)).toThrow('column no longer exists');
  });

  it('never places a value in the SQL text', () => {
    const r = compileQuery(
      { table: 'sales', filters: [{ column: 'Region', op: 'contains', value: "' OR 1=1 --" }] },
      sales,
      'postgres',
      ctx,
    );
    expect(r.text).not.toContain('OR 1=1');
  });

  it('always applies rowFilters', () => {
    const r = compileQuery({ table: 'sales' }, sales, 'postgres', {
      ...ctx,
      rowFilters: [{ column: 'Region', op: 'eq', value: 'South' }],
    });
    expect(r.text).toContain('WHERE');
    expect(r.values).toContain('South');
  });

  it('reports the effective limit and trims the extra row', () => {
    const c = compileQuery({ table: 'sales', columns: ['Region'], limit: 2 }, sales, 'postgres', ctx);
    expect(c.limit).toBe(2);
    const r = toQueryResult([{ f0: 'a' }, { f0: 'b' }, { f0: 'c' }], c);
    expect(r).toEqual({ fields: ['Region'], rows: [{ Region: 'a' }, { Region: 'b' }], truncated: true });
    expect(toQueryResult([{ f0: 'a' }], c).truncated).toBe(false);
  });

  it('caps limit at 10,000 and fetches one extra row', () => {
    expect(compileQuery({ table: 'sales', limit: 999999 }, sales, 'postgres', ctx).text).toContain('LIMIT 10001');
  });

  it('uses storage names and returns original labels', () => {
    const long = 'மொத்த விற்பனை '.repeat(10);
    const t: TableSchema = {
      name: 'sales',
      storageName: 'paarvix_data.t_abc',
      columns: [{ name: long, type: 'number', storageName: 'c0' }],
    };
    const r = compileQuery({ table: 'sales' }, t, 'postgres', ctx);
    expect(r.text).toContain('"paarvix_data"."t_abc"');
    expect(r.labels).toEqual([long]);
  });

  it('aliases every output column and restores labels', () => {
    const r = compileQuery({ table: 'sales', columns: ['Region'] }, sales, 'postgres', ctx);
    expect(r.text).toContain('"Region" AS "f0"');
    expect(labelRows([{ f0: 'South' }], r.labels)).toEqual([{ Region: 'South' }]);
  });

  it('allows only count without a column, and sum/avg only on numbers', () => {
    const agg = (fn: 'count' | 'sum' | 'avg', column?: string) =>
      compileQuery({ table: 'sales', aggregates: [{ fn, column, as: 'n' }] }, sales, 'postgres', ctx);
    expect(agg('count').text).toContain('COUNT(*)');
    expect(() => agg('sum')).toThrow();
    expect(() => agg('sum', 'Region')).toThrow();
    expect(agg('sum', 'Amount').text).toContain('SUM("Amount")');
  });

  it('escapes LIKE wildcards and picks the operator per dialect', () => {
    const spec = { table: 'sales', filters: [{ column: 'Region', op: 'contains' as const, value: '50%_\\' }] };
    const pg = compileQuery(spec, sales, 'postgres', ctx);
    expect(pg.text).toContain('ILIKE');
    expect(pg.values[0]).toBe('%50\\%\\_\\\\%');
    expect(compileQuery(spec, sales, 'mysql', ctx).text).toContain(' LIKE ');
  });

  it('compiles in and isNull', () => {
    const r = compileQuery(
      {
        table: 'sales',
        filters: [
          { column: 'Region', op: 'in', value: ['A', 'B'] },
          { column: 'Amount', op: 'isNull', value: null },
        ],
      },
      sales,
      'postgres',
      ctx,
    );
    expect(r.text).toContain('"Region" IN ($1, $2)');
    expect(r.text).toContain('"Amount" IS NULL');
  });

  const HOSTILE = 'x"; DROP TABLE users;--';
  const unknownName = /column no longer exists/;

  it.each([
    ['columns', { columns: [HOSTILE] }],
    ['filters', { filters: [{ column: HOSTILE, op: 'eq', value: 1 }] }],
    ['groupBy', { groupBy: [HOSTILE] }],
    ['orderBy', { orderBy: [{ column: HOSTILE, dir: 'asc' }] }],
    ['aggregates column', { aggregates: [{ fn: 'min', column: HOSTILE, as: 'n' }] }],
  ])('rejects an unknown name in %s', (_where, extra) => {
    expect(() => compileQuery({ table: 'sales', ...extra } as QuerySpec, sales, 'postgres', ctx)).toThrow(unknownName);
  });

  it('rejects an unknown name in rowFilters', () => {
    expect(() =>
      compileQuery({ table: 'sales' }, sales, 'postgres', { ...ctx, rowFilters: [{ column: HOSTILE, op: 'eq', value: 1 }] }),
    ).toThrow(unknownName);
  });

  it('rejects a hostile aggregate function, with or without a column', () => {
    const fn = 'max(1) as f0 from users union select password_hash from users --';
    for (const column of ['Amount', undefined]) {
      expect(() =>
        compileQuery({ table: 'sales', aggregates: [{ fn, column, as: 'n' }] } as unknown as QuerySpec, sales, 'postgres', ctx),
      ).toThrow('unknown aggregate');
    }
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'nope'])('rejects filter op %s', (op) => {
    expect(() =>
      compileQuery({ table: 'sales', filters: [{ column: 'Region', op, value: 'x' }] } as unknown as QuerySpec, sales, 'postgres', ctx),
    ).toThrow('unknown filter');
  });

  it.each([
    ['eq', null],
    ['eq', undefined],
    ['eq', { a: 1 }],
    ['eq', ['a']],
    ['eq', NaN],
    ['contains', undefined],
    ['contains', { a: 1 }],
    ['in', ['a', { b: 1 }]],
    ['in', ['a', null]],
    ['in', 'abc'],
    ['in', []],
  ])('rejects a non-scalar value for %s: %p', (op, value) => {
    expect(() =>
      compileQuery({ table: 'sales', filters: [{ column: 'Region', op, value }] } as unknown as QuerySpec, sales, 'postgres', ctx),
    ).toThrow(BadRequestException);
  });

  it('accepts text, finite numbers and booleans, and isNull ignores its value', () => {
    const r = compileQuery(
      {
        table: 'sales',
        filters: [
          { column: 'Region', op: 'eq', value: 'S' },
          { column: 'Amount', op: 'gte', value: 0 },
          { column: 'Amount', op: 'ne', value: false },
          { column: 'Amount', op: 'isNull', value: { a: 1 } },
        ],
      },
      sales,
      'postgres',
      ctx,
    );
    expect(r.values).toEqual(['S', 0, false]);
  });

  it('keeps rowFilters with user filters, aggregates and groupBy, in value order', () => {
    const r = compileQuery(
      {
        table: 'sales',
        filters: [{ column: 'Amount', op: 'gt', value: 5 }],
        groupBy: ['Region'],
        aggregates: [{ fn: 'sum', column: 'Amount', as: 'total' }],
        orderBy: [{ column: 'total', dir: 'desc' }],
      },
      sales,
      'postgres',
      { ...ctx, rowFilters: [{ column: 'Region', op: 'in', value: ['South', 'East'] }] },
    );
    expect(r.text).toBe(
      'SELECT "Region" AS "f0", SUM("Amount") AS "f1" FROM "sales" ' +
        'WHERE "Amount" > $1 AND "Region" IN ($2, $3) GROUP BY "Region" ORDER BY "f1" DESC LIMIT 10001',
    );
    expect(r.values).toEqual([5, 'South', 'East']);
    expect(r.labels).toEqual(['Region', 'total']);
  });

  it('doubles quotes and backticks in schema names', () => {
    const t: TableSchema = { name: 'we"ird`t', columns: [{ name: 'a"b`c', type: 'text' }] };
    const spec = { table: 'we"ird`t', filters: [{ column: 'a"b`c', op: 'eq' as const, value: 1 }] };
    const pg = compileQuery(spec, t, 'postgres', ctx).text;
    expect(pg).toContain('"a""b`c" = $1');
    expect(pg).toContain('FROM "we""ird`t"');
    const my = compileQuery(spec, t, 'mysql', ctx).text;
    expect(my).toContain('`a"b``c` = ?');
    expect(my).toContain('FROM `we"ird``t`');
  });

  it('treats empty columns as all columns', () => {
    const r = compileQuery({ table: 'sales', columns: [] }, sales, 'postgres', ctx);
    expect(r.labels).toEqual(['Amount', 'Region']);
  });

  it('rejects empty or duplicate output names', () => {
    const run = (extra: Partial<QuerySpec>) => () => compileQuery({ table: 'sales', ...extra }, sales, 'postgres', ctx);
    expect(run({ columns: ['Region', 'Region'] })).toThrow(BadRequestException);
    expect(run({ aggregates: [{ fn: 'count', as: '' }] })).toThrow(BadRequestException);
    expect(run({ groupBy: ['Region'], aggregates: [{ fn: 'count', as: 'Region' }] })).toThrow(BadRequestException);
  });
});
