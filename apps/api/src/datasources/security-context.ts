/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import type { SecurityContext, UserRole } from '@paarvix/shared';

/** Builds the context every data path needs. rowFilters stay empty until RLS (P2 Pro). */
export function toSecurityContext(user: { id: string; role: string }): SecurityContext {
  return { userId: user.id, role: user.role as UserRole, tenantId: null, rowFilters: [] };
}
