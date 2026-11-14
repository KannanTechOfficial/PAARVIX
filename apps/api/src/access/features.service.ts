/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { GATED_FEATURES, type GatedFeature } from '@paarvix/shared';

/**
 * The one place a feature that may become Pro is checked.
 * Every gate is open until the free/Pro split is decided before the first public release
 * (founder decision, 2026-11-14). The licence system will replace isEnabled.
 */
@Injectable()
export class FeaturesService {
  isEnabled(_feature: GatedFeature): boolean {
    return true;
  }

  assertEnabled(feature: GatedFeature): void {
    if (!this.isEnabled(feature)) {
      throw new ForbiddenException(`${GATED_FEATURES[feature]} needs a licence`);
    }
  }

  list(): { id: GatedFeature; label: string; enabled: boolean }[] {
    return (Object.keys(GATED_FEATURES) as GatedFeature[]).map((id) => ({
      id,
      label: GATED_FEATURES[id],
      enabled: this.isEnabled(id),
    }));
  }
}
