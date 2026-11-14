/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, signal } from '@angular/core';

/**
 * The phone top bar's title. A page sets it; it appears once the page's own large title has
 * scrolled away, the way native apps collapse a large title into the bar.
 */
@Injectable({ providedIn: 'root' })
export class AppBarService {
  readonly title = signal('');
  readonly showTitle = signal(false);
}

/** A light tap on phones that support it (Android). Never on desktop, never when reduced motion is asked for. */
export function haptic(ms = 8) {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(ms);
  } catch {
    /* not available */
  }
}
