/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW_MS = 15 * 60 * 1000;
/** Wrong passwords allowed for one account from one address before a pause. */
const PER_ACCOUNT = 5;
/** Wrong passwords allowed from one address across all accounts (slows password spraying). */
const PER_ADDRESS = 30;
const MAX_KEYS = 10_000;

interface Bucket { failures: number[]; lockedUntil: number }

/**
 * Slows password guessing. Keyed on account plus address, so an attacker elsewhere cannot lock
 * the real person out. In memory, which fits lite mode; scale mode will move this to Redis.
 */
@Injectable()
export class LoginThrottleService {
  private readonly buckets = new Map<string, Bucket>();

  private bucket(key: string, now: number): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= MAX_KEYS) this.sweep(now);
      b = { failures: [], lockedUntil: 0 };
      this.buckets.set(key, b);
    }
    b.failures = b.failures.filter((t) => now - t < WINDOW_MS);
    return b;
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) {
      if (b.lockedUntil < now && b.failures.every((t) => now - t >= WINDOW_MS)) this.buckets.delete(k);
    }
    if (this.buckets.size >= MAX_KEYS) this.buckets.clear(); // never grow without bound under attack
  }

  private keys(email: string, ip: string) {
    const e = email.trim().toLowerCase();
    return [`acct:${e}|${ip}`, `addr:${ip}`] as const;
  }

  /** Throws 429 with a plain explanation while a pause is active. Call before checking the password. */
  assertAllowed(email: string, ip: string) {
    const now = Date.now();
    for (const key of this.keys(email, ip)) {
      const b = this.bucket(key, now);
      if (b.lockedUntil > now) {
        const minutes = Math.ceil((b.lockedUntil - now) / 60_000);
        throw new HttpException(
          `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or sign in with Google.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(email: string, ip: string) {
    const now = Date.now();
    const [account, address] = this.keys(email, ip);
    for (const [key, limit] of [[account, PER_ACCOUNT], [address, PER_ADDRESS]] as const) {
      const b = this.bucket(key, now);
      b.failures.push(now);
      if (b.failures.length >= limit) {
        b.lockedUntil = now + WINDOW_MS;
        b.failures = [];
      }
    }
  }

  /** A correct password clears that account's count from that address. */
  recordSuccess(email: string, ip: string) {
    this.buckets.delete(this.keys(email, ip)[0]);
  }
}
