/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SetupDto } from './dto/setup.dto';
import { requireSecret } from './require-secret';
import { SUPER_ADMIN } from '@paarvix/shared';
import { RolesService } from '../access/roles.service';
import { LoginThrottleService } from './login-throttle.service';
import { SessionsService, type SessionMeta, type SessionMethod } from './sessions.service';

/** What a refresh token carries: who, which session, and the session's current one-time id. */
interface RefreshPayload {
  sub: string;
  sid?: string;
  jti?: string;
  typ?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Checked when no account matches, so a missing email takes as long as a wrong password. */
  private readonly dummyHash = argon2.hash('paarvix-no-such-user', { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
    private readonly throttle: LoginThrottleService,
    private readonly sessions: SessionsService,
  ) {}

  async setup(dto: SetupDto, meta: SessionMeta = {}) {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      throw new ConflictException('Setup already completed');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        roleId: await this.roles.idFor(SUPER_ADMIN),
        language: dto.language || 'en',
      },
    });

    this.logger.log(`Super Admin created: ${user.email}`);
    return this.issue(user.id, 'setup', meta);
  }

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    const email = String(dto.email ?? '').trim();
    this.throttle.assertAllowed(email, ip);
    // Emails are matched without case, so "Kannan@…" and "kannan@…" are the same account.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    // Same message and the same work for a missing account, so sign-in does not reveal which emails exist.
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const valid = (await argon2.verify(hash, String(dto.password ?? '')).catch(() => false)) && !!user;
    if (!user || !user.isActive || !valid) {
      this.throttle.recordFailure(email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }
    this.throttle.recordSuccess(email, ip);

    this.logger.log(`User logged in: ${user.email}`);
    return this.issue(user.id, 'password', { ip, userAgent });
  }

  async isSetupRequired(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count === 0;
  }

  /** The signed-in user's profile, role and permissions, for the web app. */
  async me(userId: string) {
    const user = await this.roles.resolve(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  /**
   * Signs someone in: starts a server-side session and returns its first token pair.
   * Refuses a user with no usable role, so an account cannot sign in with zero permissions by accident.
   */
  async issue(userId: string, method: SessionMethod, meta: SessionMeta = {}) {
    const user = await this.roles.resolve(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const { sessionId, tokenId } = await this.sessions.create(user.id, method, meta);
    return { ...this.sign(user.id, user.email, sessionId, tokenId), user };
  }

  /**
   * Swaps a refresh token for a new pair in the same session. Refused once the session has ended
   * (signed out, password reset, deactivated, ended from another device) or the account is inactive.
   * An old refresh token used again ends the session: see SessionsService.rotate.
   */
  async refresh(token: string | undefined, meta: SessionMeta = {}) {
    const payload = this.readRefresh(token, false);
    // Tokens from before server-side sessions name no session; they must sign in once more.
    if (!payload?.sid || !payload.jti) throw new UnauthorizedException('Please sign in again');
    const user = await this.roles.resolve(payload.sub);
    if (!user) {
      await this.sessions.revoke(payload.sid, 'deactivated');
      throw new UnauthorizedException('Please sign in again');
    }
    const next = await this.sessions.rotate(payload.sid, user.id, payload.jti, meta);
    return { ...this.sign(user.id, user.email, payload.sid, next), user };
  }

  /**
   * Ends the session a refresh token belongs to. An expired token still names its session, so it is
   * read without the expiry check; the signature is still verified, so nobody can end another person's session.
   */
  async logout(token: string | undefined) {
    const payload = this.readRefresh(token, true);
    if (payload?.sid) await this.sessions.revoke(payload.sid, 'signed_out');
  }

  private readRefresh(token: string | undefined, ignoreExpiration: boolean): RefreshPayload | null {
    if (!token) return null;
    try {
      const p = this.jwt.verify<RefreshPayload>(token, { secret: requireSecret(this.config, 'JWT_REFRESH_SECRET'), ignoreExpiration });
      return p.typ === 'refresh' ? p : null;
    } catch {
      return null;
    }
  }

  private sign(userId: string, email: string, sessionId: string, tokenId: string) {
    // Both tokens name the session, so ending it stops the 15-minute access token as well, not just renewal.
    const accessToken = this.jwt.sign({ sub: userId, email, sid: sessionId });
    const refreshToken = this.jwt.sign(
      { sub: userId, sid: sessionId, jti: tokenId, typ: 'refresh' },
      { secret: requireSecret(this.config, 'JWT_REFRESH_SECRET'), expiresIn: Math.floor(this.sessions.idleMs / 1000) },
    );
    return { accessToken, refreshToken };
  }
}
