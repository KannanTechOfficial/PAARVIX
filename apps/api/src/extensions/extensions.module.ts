/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Global, Module } from '@nestjs/common';
import { AUDIT_SINK, NoopAuditSink } from './extension-points';

/** Community defaults for every extension point. An optional module imported after this one replaces them. */
@Global()
@Module({
  providers: [{ provide: AUDIT_SINK, useClass: NoopAuditSink }],
  exports: [AUDIT_SINK],
})
export class ExtensionsModule {}
