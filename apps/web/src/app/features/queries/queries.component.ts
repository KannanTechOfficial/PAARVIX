/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'pvx-queries',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="pvx-page">
      <h2>{{ 'nav.queries' | translate }}</h2>
      <div class="pvx-card">
        <p>Visual Query Builder & SQL Editor.</p>
      </div>
    </div>
  `,
  styles: [`
    .pvx-page { max-width: 1200px; margin: 0 auto; }
    h2 { margin-bottom: 24px; }
    .pvx-card { padding: 32px; background: var(--pvx-bg-card); border-radius: var(--pvx-radius); border: 1px solid var(--pvx-border); }
  `],
})
export class QueriesComponent {}
