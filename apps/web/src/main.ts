/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

if ('serviceWorker' in navigator) {
  if (isDevMode()) {
    // During development files change constantly; a service worker would serve old copies
    // and can mix two versions of Angular in one page. Remove any left from earlier runs.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister())).catch(() => undefined);
    if ('caches' in window) {
      caches.keys().then((keys) => keys.filter((k) => k.startsWith('paarvix-static-')).forEach((k) => void caches.delete(k))).catch(() => undefined);
    }
  } else if (location.protocol === 'https:' || location.hostname === 'localhost') {
    // Installable app in production builds only, registered after load so it never slows the first screen.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}
