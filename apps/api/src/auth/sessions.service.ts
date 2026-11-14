/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type SessionMethod = 'password' | 'google' | 'setup';
export type RevokeReason =
  | 'signed_out'
  | 'signed_out_elsewhere'
  | 'password_reset'
  | 'deactivated'
  | 'admin'
  | 'reuse'
  | 'limit';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/** A device's view of one of its owner's sessions. The token hash never leaves the server. */
export interface SessionSummary {
  id: string;
  method: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
}

/** How long a renewed-away token is still accepted, for two tabs renewing at the same moment. */
const GRACE_MS = 30_000;
/** Oldest sessions are ended beyond this many per person, so the table cannot grow without limit. */
const MAX_ACTIVE_PER_USER = 20;
/** Ended and expired sessions are deleted after this long. */
const KEEP_ENDED_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newTokenId = () => randomBytes(32).toString('base64url');

/** Reads "15m", "7d", "12h", "3600s" or plain seconds. Anything else falls back. */
export function parseDuration(value: string | undefined, fallbackMs: number): number {
  const m = /^\s*(\d+)\s*([smhd]?)\s*$/i.exec(value ?? '');
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = { '': 1000, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2].toLowerCase() as '' | 's' | 'm' | 'h' | 'd'];
  return n > 0 ? n * unit : fallbackMs;
}

/**
 * Server-side sessions. Every refresh token names its session and carries a one-time id;
 * the server keeps only that id's hash. Signing out, a password reset or deactivation ends
 * the session here, so a copied cookie or token stops working at once, not when it expires.
 *
 * Each renewal swaps the one-time id. If an id that was already swapped comes back later,
 * someone is replaying an old cookie, and the whole session is ended.
 */
@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private timer?: NodeJS.Timeout;
  /** Idle limit: a session not renewed for this long ends. */
  readonly idleMs: number;
  /** Absolute limit: a session ends this long after sign-in, however active. */
  readonly maxMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.idleMs = parseDuration(config.get<string>('JWT_REFRESH_EXPIRY'), 7 * 86_400_000);
    this.maxMs = Math.max(this.idleMs, parseDuration(config.get<string>('SESSION_MAX_AGE'), 30 * 86_400_000));
  }

  onModuleInit() {
    void this.prune();
    this.timer = setInterval(() => void this.prune(), PRUNE_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Starts a session at sign-in. Returns its id and the first one-time token id. */
  async create(userId: string, method: SessionMethod, meta: SessionMeta = {}) {
    const tokenId = newTokenId();
    const now = Date.now();
    const session = await this.prisma.session.create({
      data: {
        userId,
        method,
        tokenHash: sha256(tokenId),
        userAgent: meta.userAgent?.slice(0, 300) || null,
        ip: meta.ip?.slice(0, 64) || null,
        expiresAt: new Date(now + this.idleMs),
        maxExpiresAt: new Date(now + this.maxMs),
      },
    });
    await this.enforceLimit(userId);
    return { sessionId: session.id, tokenId };
  }

  /**
   * Swaps a refresh token's one-time id for a new one. Refused when the session has ended or expired,
   * or belongs to someone else. An old id coming back after its grace period ends the session.
   */
  async rotate(sessionId: string, userId: string, tokenId: string, meta: SessionMeta = {}) {
    const hash = sha256(tokenId);
    // Two attempts: a concurrent renewal can change the row between the read and the write.
    for (let attempt = 0; attempt < 2; attempt++) {
      const s = await this.prisma.session.findUnique({ where: { id: sessionId } });
      const now = new Date();
      if (!s || s.userId !== userId || s.revokedAt || s.expiresAt <= now || s.maxExpiresAt <= now) {
        throw new UnauthorizedException('Please sign in again');
      }
      const isCurrent = s.tokenHash === hash;
      const inGrace = !isCurrent && s.previousHash === hash && !!s.previousUntil && s.previousUntil > now;
      if (!isCurrent && !inGrace) {
        // Not the latest id and not a moment-old one: an old cookie is being replayed. End the session.
        await this.revoke(sessionId, 'reuse');
        this.logger.warn(`Refresh token reused for session ${sessionId}; session ended`);
        throw new UnauthorizedException('Please sign in again');
      }
      const next = newTokenId();
      const idleEnd = new Date(Math.min(now.getTime() + this.idleMs, s.maxExpiresAt.getTime()));
      // Only swaps if nobody else did since the read; otherwise the loop reads again.
      const { count } = await this.prisma.session.updateMany({
        where: { id: sessionId, tokenHash: s.tokenHash, revokedAt: null },
        data: {
          tokenHash: sha256(next),
          previousHash: s.tokenHash,
          previousUntil: new Date(now.getTime() + GRACE_MS),
          lastUsedAt: now,
          expiresAt: idleEnd,
          ...(meta.ip ? { ip: meta.ip.slice(0, 64) } : {}),
          ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 300) } : {}),
        },
      });
      if (count === 1) return next;
    }
    throw new UnauthorizedException('Please sign in again');
  }

  /** True while the session can still be used. Checked on every API request, so an ended session stops at once. */
  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const s = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true, maxExpiresAt: true },
    });
    const now = new Date();
    return !!s && s.userId === userId && !s.revokedAt && s.expiresAt > now && s.maxExpiresAt > now;
  }

  async revoke(sessionId: string, reason: RevokeReason) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Ends every session a person has, optionally keeping the one they are using now. */
  async revokeAll(userId: string, reason: RevokeReason, exceptSessionId?: string) {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return count;
  }

  /** Ends one of a person's own sessions. Someone else's session id is treated as not found. */
  async revokeOwn(userId: string, sessionId: string) {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'signed_out_elsewhere' },
    });
    if (!count) throw new NotFoundException('Session not found');
  }

  /** A person's sessions that can still be used, most recent first. */
  async listActive(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
    const now = new Date();
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now }, maxExpiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, method: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === currentSessionId }));
  }

  private async enforceLimit(userId: string) {
    const now = new Date();
    const extra = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
      skip: MAX_ACTIVE_PER_USER,
      select: { id: true },
    });
    if (extra.length) {
      await this.prisma.session.updateMany({
        where: { id: { in: extra.map((e) => e.id) } },
        data: { revokedAt: now, revokedReason: 'limit' },
      });
    }
  }

  /** Deletes sessions that ended or expired over 30 days ago. */
  async prune() {
    const cutoff = new Date(Date.now() - KEEP_ENDED_MS);
    try {
      await this.prisma.session.deleteMany({
        where: { OR: [{ revokedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }, { maxExpiresAt: { lt: cutoff } }] },
      });
    } catch (e) {
      this.logger.warn(`Could not prune old sessions: ${(e as Error).message}`);
    }
  }
}
