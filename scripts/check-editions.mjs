#!/usr/bin/env node
/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

// CI guard for the open-core split. Run after packages/shared is built.
//  1. Community stays free: every feature in scripts/community-features.json must still be Community.
//  2. No paid code in the public repository: nothing may import @paarvix-pro except the one optional
//     loader, and the public optional-routes file must stay empty.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const problems = [];

// 1. Community promise.
const { FEATURES } = require(join(root, 'packages/shared/dist/editions.js'));
const promised = JSON.parse(readFileSync(join(root, 'scripts/community-features.json'), 'utf8')).features;
for (const id of promised) {
  if (!FEATURES[id]) problems.push(`Community feature "${id}" was removed from editions.ts. Community features are free forever.`);
  else if (FEATURES[id].edition !== 'community') problems.push(`Community feature "${id}" was moved to ${FEATURES[id].edition}. Never move a free feature to paid.`);
}
const unlisted = Object.keys(FEATURES).filter((k) => FEATURES[k].edition === 'community' && !promised.includes(k));
if (unlisted.length) problems.push(`New Community features not yet in scripts/community-features.json: ${unlisted.join(', ')}. Add them there.`);

// 2. No paid code.
const ALLOWED = new Set(['apps/api/src/extensions/optional-modules.ts']);
const SKIP = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage']);
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|mts|js|mjs|json)$/.test(name) && !name.endsWith('package-lock.json')) {
      const rel = relative(root, full);
      if (ALLOWED.has(rel)) continue;
      if (readFileSync(full, 'utf8').includes('@paarvix-pro')) problems.push(`${rel} refers to @paarvix-pro. Paid code belongs in the private paarvix-pro repository; use an extension point.`);
    }
  }
}
for (const dir of ['apps', 'packages']) walk(join(root, dir));
const optional = readFileSync(join(root, 'apps/web/src/app/optional-routes.ts'), 'utf8');
if (!/OPTIONAL_ROUTES:\s*Routes\s*=\s*\[\s*\]/.test(optional)) problems.push('apps/web/src/app/optional-routes.ts must stay empty in the public repository.');

if (problems.length) {
  console.error('✗ Edition check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Edition check passed: ${promised.length} Community features protected, no paid code found.`);
