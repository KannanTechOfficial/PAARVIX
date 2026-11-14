/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, signal, effect } from '@angular/core';
import type { ThemeTokens } from './admin-api.service';

export type Theme = 'light' | 'dark';

const HEX = /^#[0-9a-fA-F]{6}$/;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'pvx_theme';
  readonly theme = signal<Theme>(this.getInitialTheme());
  readonly orgName = signal('Paarvix');

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
      // The phone's status bar takes the page colour, so it blends into the top bar.
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#06080D' : '#F5F6F8');
    });
    // Until someone chooses, follow the device, including when it switches at sunset.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!this.saved()) this.theme.set(e.matches ? 'dark' : 'light');
    });
  }

  /** An explicit choice is remembered on this device; without one the device setting applies. */
  toggle() {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
    try {
      localStorage.setItem(this.storageKey, this.theme());
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  }

  private saved(): Theme | null {
    try {
      const v = localStorage.getItem(this.storageKey);
      return v === 'light' || v === 'dark' ? v : null;
    } catch {
      return null;
    }
  }

  /**
   * Theme layer 1. Sets workspace tokens on the root. The Administration area resets them
   * to the defaults in styles.scss, so a bad theme can never hide the controls that fix it.
   * Values are re-checked here, so nothing but a colour or a number reaches a style.
   */
  applyTokens(tokens: ThemeTokens) {
    const root = document.documentElement.style;
    const set = (name: string, value: string, ok: boolean) => (ok ? root.setProperty(name, value) : root.removeProperty(name));
    set('--pvx-ws-primary', tokens.primary, HEX.test(tokens.primary));
    set('--pvx-ws-accent', tokens.accent, HEX.test(tokens.accent));
    set('--pvx-ws-warn', tokens.warn, HEX.test(tokens.warn));
    set('--pvx-ws-radius', `${tokens.radius}px`, Number.isInteger(tokens.radius) && tokens.radius >= 0 && tokens.radius <= 16);
    document.documentElement.setAttribute('data-density', tokens.density === 'compact' ? 'compact' : 'comfortable');
  }

  private getInitialTheme(): Theme {
    const saved = this.saved();
    if (saved) return saved;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}
