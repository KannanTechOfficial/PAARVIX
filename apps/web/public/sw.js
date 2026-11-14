/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 *
 * Makes Paarvix installable and quick to reopen. Deliberately cautious:
 * - API requests are never touched: data and sign-in always go to the server.
 * - Pages and unhashed files are fetched fresh, so a new release is never hidden by an old copy.
 * - Only files whose names contain a content hash (they never change) and icons are served from cache.
 */
const STATIC = 'paarvix-static-v1';
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('paarvix-static-') && key !== STATIC) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const cacheable = HASHED.test(url.pathname) || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/monaco/');
  if (cacheable) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Everything else: the network first; the last copy only when there is no connection.
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && (req.mode === 'navigate' || url.pathname === '/')) (await caches.open(STATIC)).put('/', res.clone());
      return res;
    } catch (e) {
      const cached = await caches.match(req.mode === 'navigate' ? '/' : req);
      if (cached) return cached;
      throw e;
    }
  })());
});
