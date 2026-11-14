/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

// Copies Monaco's prebuilt editor into public/assets so the app serves it itself:
// no CDN, so the SQL editor works offline and on a campus network.
// Angular can only copy assets from inside this app's folder, and npm installs Monaco at the repo root.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Monaco does not export its package.json, so find its folder in the nearest node_modules.
let pkgDir = '';
for (let dir = here; dir !== dirname(dir); dir = dirname(dir)) {
  if (existsSync(join(dir, 'node_modules', 'monaco-editor', 'min', 'vs', 'loader.js'))) {
    pkgDir = join(dir, 'node_modules', 'monaco-editor');
    break;
  }
}
if (!pkgDir) {
  console.error('monaco-editor is not installed. Run npm install.');
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const target = join(here, '..', 'public', 'assets', 'monaco');
const stamp = join(target, 'VERSION');

if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version) process.exit(0);
cpSync(join(pkgDir, 'min', 'vs'), join(target, 'vs'), { recursive: true });
writeFileSync(stamp, version);
console.log(`Monaco ${version} copied to public/assets/monaco`);
