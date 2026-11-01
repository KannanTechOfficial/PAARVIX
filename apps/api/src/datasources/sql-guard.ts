/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';

/** Accepts one SELECT or WITH statement. The read-only transaction is the real barrier. */
export function assertReadOnlySql(sql: string): string {
  const text = typeof sql === 'string' ? sql.trim().replace(/;\s*$/, '') : '';
  if (!/^(select|with)\b/i.test(text) || text.includes(';')) {
    throw new BadRequestException('Only a single SELECT or WITH statement is allowed');
  }
  return text;
}
