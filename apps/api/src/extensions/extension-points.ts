/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/**
 * Extension points: the places where optional modules (Paarvix Pro, or anyone's plugin) plug in.
 * Each has a token and a Community default. An optional module provides its own class for the token;
 * core code only ever asks for the token, so it never imports paid code.
 *
 * Add a new extension point here first, in the public repository, whenever a paid feature needs a hook.
 * Community plugin authors can use the same hook.
 */

/** Something worth recording for accountability: who did what, when. */
export interface AuditEvent {
  actorId: string | null;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  at: Date;
}

/** Where audit events go. Community discards them; the Pro audit log stores and shows them. */
export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');

/** Community default: nothing is stored. */
export class NoopAuditSink implements AuditSink {
  async record(): Promise<void> {
    /* Community keeps no audit log */
  }
}
