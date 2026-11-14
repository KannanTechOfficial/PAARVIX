/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Global, Module } from '@nestjs/common';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';

/** Global, so any module can check a feature's licence through FeaturesService. */
@Global()
@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
