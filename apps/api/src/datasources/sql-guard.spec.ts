/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import { assertReadOnlySql } from './sql-guard';

describe('assertReadOnlySql', () => {
  it('accepts a single SELECT or WITH statement', () => {
    expect(assertReadOnlySql('SELECT 1')).toBe('SELECT 1');
    expect(assertReadOnlySql('with a as (select 1) select * from a')).toContain('select * from a');
    expect(assertReadOnlySql('SELECT 1;  ')).toBe('SELECT 1');
  });

  it('rejects writes, stacked statements and empty input', () => {
    expect(() => assertReadOnlySql('DELETE FROM x')).toThrow(BadRequestException);
    expect(() => assertReadOnlySql('SELECT 1; DROP TABLE x')).toThrow(BadRequestException);
    expect(() => assertReadOnlySql('')).toThrow(BadRequestException);
    expect(() => assertReadOnlySql(undefined as unknown as string)).toThrow(BadRequestException);
  });
});
