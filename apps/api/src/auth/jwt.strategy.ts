/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { requireSecret } from './require-secret';
import { RolesService } from '../access/roles.service';
import type { AuthUser } from '../access/auth-user';
import { SessionsService } from './sessions.service';

interface JwtPayload {
  sub: string;
  email: string;
  /** The server-side session. Tokens without one come from before sessions and are refused. */
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret(config, 'JWT_SECRET'),
    });
  }

  /**
   * Role and permissions are read fresh on every request; the token carries only the user and session ids.
   * The session is checked too, so signing out or a password reset stops this token at once,
   * instead of when its 15 minutes run out.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sid) throw new UnauthorizedException();
    const [user, active] = await Promise.all([this.roles.resolve(payload.sub), this.sessions.isActive(payload.sid, payload.sub)]);
    if (!user || !active) throw new UnauthorizedException();
    return { ...user, sessionId: payload.sid };
  }
}
