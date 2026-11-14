/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Global, Module } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { PermissionsGuard } from './permissions.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Global()
@Module({
  controllers: [RolesController],
  providers: [RolesService, FeaturesService, PermissionsGuard],
  exports: [RolesService, FeaturesService, PermissionsGuard],
})
export class AccessModule {}
