/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ConfigService } from '@nestjs/config';
import { requireSecret } from './require-secret';

const config = (value?: string) => ({ get: () => value }) as unknown as ConfigService;

describe('requireSecret', () => {
  it.each([[undefined], [''], ['short'], ['CHANGE_ME_' + 'x'.repeat(40)], ['dev_jwt_secret_change_in_production_64chars_key_paarvix'], ['dev-secret-change-me-' + 'x'.repeat(20)]])(
    'refuses %s',
    (value) => expect(() => requireSecret(config(value), 'JWT_SECRET')).toThrow('JWT_SECRET'),
  );

  it('accepts a long random value', () => {
    expect(requireSecret(config('a1b2'.repeat(16)), 'JWT_SECRET')).toHaveLength(64);
  });
});
