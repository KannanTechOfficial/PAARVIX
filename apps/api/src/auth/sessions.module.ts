/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Global, Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';

/** Global, so user management can end someone's sessions without importing the whole auth module. */
@Global()
@Module({
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
