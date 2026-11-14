/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Logger, type DynamicModule } from '@nestjs/common';

/**
 * The only place core refers to Paarvix Pro, and only by package name. When the package is not
 * installed (every Community install), nothing is loaded and Paarvix runs as Community.
 * When it is installed, its module registers Pro providers for the extension points; each Pro feature
 * still checks the licence itself before doing anything.
 */
const PRO_PACKAGE = '@paarvix-pro/api';

export async function loadOptionalModules(): Promise<DynamicModule[]> {
  const logger = new Logger('OptionalModules');
  let mod: { PaarvixProModule?: { register(): DynamicModule } };
  try {
    mod = await import(PRO_PACKAGE);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // Not installed: the normal Community case. Any other failure is a broken Pro install and must be seen.
    if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ERR_MODULE_NOT_FOUND') {
      if (String(err.message ?? '').includes(PRO_PACKAGE)) return [];
    }
    throw e;
  }
  if (!mod.PaarvixProModule?.register) {
    logger.warn(`${PRO_PACKAGE} is installed but exports no PaarvixProModule; ignoring it`);
    return [];
  }
  logger.log('Paarvix Pro modules loaded');
  return [mod.PaarvixProModule.register()];
}
