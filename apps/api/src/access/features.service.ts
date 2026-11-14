/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { ALL_FEATURES, FEATURES, type Edition, type Feature } from '@paarvix/shared';
import { LicenseService } from '../license/license.service';

/**
 * The one place a feature's edition is checked. Community features are always on;
 * Pro and Enterprise features need a licence (see editions.ts and LicenseService).
 */
@Injectable()
export class FeaturesService {
  constructor(private readonly license: LicenseService) {}

  isEnabled(feature: Feature): boolean {
    return this.license.allows(feature);
  }

  assertEnabled(feature: Feature): void {
    if (!this.isEnabled(feature)) {
      const f = FEATURES[feature];
      throw new ForbiddenException(`${f.label} is part of Paarvix ${f.edition === 'pro' ? 'Pro' : 'Enterprise'}. Add a licence in Administration → Licence.`);
    }
  }

  list(): { id: Feature; label: string; edition: Edition; built: boolean; enabled: boolean }[] {
    return ALL_FEATURES.map((id) => ({ id, label: FEATURES[id].label, edition: FEATURES[id].edition, built: FEATURES[id].built, enabled: this.isEnabled(id) }));
  }
}
