/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';

function key(): Buffer {
  const raw = process.env.PAARVIX_ENCRYPTION_KEY;
  if (!raw || raw.startsWith('CHANGE_ME')) {
    throw new BadRequestException('Set PAARVIX_ENCRYPTION_KEY before using data sources');
  }
  return createHash('sha256').update(raw).digest();
}

/** AES-256-GCM. Output: iv.tag.ciphertext in base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
