/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ConfigService } from '@nestjs/config';

const MIN_LENGTH = 32;

/** A known or short signing secret would let anyone forge an admin login, so the API refuses to start. */
export function requireSecret(config: ConfigService, name: string): string {
  const value = config.get<string>(name) ?? '';
  if (value.length < MIN_LENGTH || /^(CHANGE_ME|dev[-_])/i.test(value)) {
    throw new Error(`Set ${name} to a long random value. ./install.sh creates one for you.`);
  }
  return value;
}
