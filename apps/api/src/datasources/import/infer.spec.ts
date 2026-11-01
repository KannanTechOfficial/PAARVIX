/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ColumnTracker, normalise } from './infer';

function infer(values: unknown[]) {
  const t = new ColumnTracker();
  values.forEach((v) => t.add(v));
  return t.type();
}

describe('column type inference', () => {
  it.each([
    [['1,25,000', '₹2,500.50', 300], 'number'],
    [['15-08-2026', '01/02/2026'], 'date'],
    [['true', 'FALSE'], 'boolean'],
    [['00123', '00456'], 'text'],
    [['9876543210', '9123456780'], 'text'],
    [['1234567890123456', '1234567890123457'], 'text'],
    [[9876543210, 9123456780], 'text'],
    [['12', 'pending'], 'text'],
    [[null, '', 5], 'number'],
    [[null, '', '  '], 'text'],
    [[new Date(Date.UTC(2026, 0, 5)), '05-01-2026'], 'date'],
    [['31-02-2026'], 'text'],
    [[true, 5], 'text'],
    [['-12.5', '0', '0.75', '1,250,000'], 'number'],
    [['+919876543210'], 'text'],
    [['+5', '+12.5'], 'number'],
    [['-00123'], 'text'],
    [['007.5'], 'text'],
    [['₹007'], 'text'],
    [['12345678901234567.89'], 'text'],
    [['1,234,567,890,123,456,789'], 'text'],
    [['1,234,567,890,123'], 'number'],
    [['1.50000000000000000000'], 'number'],
    [[`1${',000'.repeat(100)}`], 'text'],
    [[12345678901.5, 3], 'number'], // only whole numbers of 10+ digits are identifiers
    [[1500000000], 'text'],
    [[new Date('invalid')], 'text'],
    [[new Date(Date.UTC(12000, 0, 1)), new Date(Date.UTC(2026, 0, 1))], 'date'],
  ])('%j infers %s', (values, expected) => {
    expect(infer(values as unknown[])).toBe(expected);
  });
});

describe('normalise', () => {
  it('reads DD-MM-YYYY as day first', () => {
    expect(normalise('01-02-2026', 'date')).toEqual(new Date(Date.UTC(2026, 1, 1)));
  });
  it('parses Indian grouping', () => {
    expect(normalise('₹1,25,000', 'number')).toBe(125000);
    expect(normalise('₹2,500.50', 'number')).toBe(2500.5);
    expect(normalise(300, 'number')).toBe(300);
  });
  it('turns blanks into null', () => {
    expect(normalise('', 'number')).toBeNull();
    expect(normalise('  ', 'text')).toBeNull();
    expect(normalise(undefined, 'date')).toBeNull();
  });
  it('keeps text exactly, but drops NUL bytes Postgres rejects', () => {
    expect(normalise('00123', 'text')).toBe('00123');
    expect(normalise(9876543210, 'text')).toBe('9876543210');
    expect(normalise('a\u0000b', 'text')).toBe('ab');
  });
  it('never stores an unrepresentable date', () => {
    expect(normalise(new Date('invalid'), 'date')).toBeNull();
    expect(normalise(new Date(Date.UTC(12000, 0, 1)), 'date')).toBeNull();
    expect(normalise(new Date(Date.UTC(12000, 0, 1)), 'text')).toBeNull();
    expect(normalise(new Date('invalid'), 'boolean')).toBeNull();
  });
  it('reads booleans', () => {
    expect(normalise('FALSE', 'boolean')).toBe(false);
    expect(normalise(true, 'boolean')).toBe(true);
  });
});
