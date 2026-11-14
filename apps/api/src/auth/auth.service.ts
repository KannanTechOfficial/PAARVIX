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
  ) {}

  async setup(dto: SetupDto) {
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
    return this.issue(user.id);
  }

  async login(dto: LoginDto, ip: string) {
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
    return this.issue(user.id);
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

  /** Refuses a user with no usable role, so an account cannot sign in with zero permissions by accident. */
  async issue(userId: string) {
    const user = await this.roles.resolve(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const { sessionVersion } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign({ ...payload, sv: sessionVersion, typ: 'refresh' }, {
      secret: requireSecret(this.config, 'JWT_REFRESH_SECRET'),
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRY', '7d') as any),
    });

    return { accessToken, refreshToken, user };
  }

  /**
   * Swaps a valid refresh token for a new pair. Refused once the account is inactive,
   * or after a password reset or deactivation raised its session version.
   */
  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Please sign in again');
    let payload: { sub: string; sv?: number; typ?: string };
    try {
      payload = this.jwt.verify(token, { secret: requireSecret(this.config, 'JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Please sign in again');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Please sign in again');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isActive: true, sessionVersion: true } });
    if (!user || !user.isActive || user.sessionVersion !== payload.sv) throw new UnauthorizedException('Please sign in again');
    return this.issue(payload.sub);
  }
}
