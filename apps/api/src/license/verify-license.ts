/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { ALL_FEATURES, type LicensePayload } from '@paarvix/shared';

/** A licence key is "PVX1.<payload>.<signature>", both base64url; the signature covers "PVX1.<payload>". */
const PREFIX = 'PVX1.';
const MAX_LENGTH = 8192;

export type VerifyResult = { ok: true; payload: LicensePayload } | { ok: false; problem: string };

const isDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Checks the signature and shape of a licence key. Says nothing about expiry; the caller decides that. */
export function verifyLicense(key: string, publicKey: KeyObject | string): VerifyResult {
  const text = String(key ?? '').trim();
  if (!text) return { ok: false, problem: 'No licence key given.' };
  if (text.length > MAX_LENGTH || !text.startsWith(PREFIX)) return { ok: false, problem: 'This is not a Paarvix licence key.' };
  const lastDot = text.lastIndexOf('.');
  const body = text.slice(0, lastDot);
  const signature = text.slice(lastDot + 1);
  if (lastDot <= PREFIX.length || !signature) return { ok: false, problem: 'This licence key is incomplete. Copy it again, in full.' };

  const keyObject = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
  let valid = false;
  try {
    valid = verify(null, Buffer.from(body), keyObject, Buffer.from(signature, 'base64url'));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, problem: 'This licence key was not issued by KannanTech, or it was changed.' };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(Buffer.from(body.slice(PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    return { ok: false, problem: 'This licence key cannot be read.' };
  }
  if (
    !payload ||
    typeof payload.id !== 'string' ||
    typeof payload.customer !== 'string' ||
    (payload.edition !== 'pro' && payload.edition !== 'enterprise') ||
    !isDate(payload.issuedAt) ||
    !isDate(payload.expiresAt)
  ) {
    return { ok: false, problem: 'This licence key is missing details. Ask support@kannantech.com for a new one.' };
  }
  // Unknown feature names (from a newer Paarvix) are ignored, not refused.
  payload.features = (payload.features ?? []).filter((f) => (ALL_FEATURES as string[]).includes(f));
  return { ok: true, payload };
}
