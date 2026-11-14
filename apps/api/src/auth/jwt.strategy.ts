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

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly roles: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret(config, 'JWT_SECRET'),
    });
  }

  /** Role and permissions are read fresh on every request; the token carries only the user id. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.roles.resolve(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
