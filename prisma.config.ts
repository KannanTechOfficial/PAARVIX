/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  datasource: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://paarvix:paarvix_secret@localhost:5432/paarvix',
  },
});
