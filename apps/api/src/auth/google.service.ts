/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { requireSecret } from './require-secret';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const FLOW_TTL_MS = 10 * 60 * 1000;

/** Why a Google sign-in failed. The web app shows a message for each; details stay in the server log. */
export type GoogleFailure = 'google_state' | 'google_denied' | 'google_exchange' | 'google_unverified' | 'google_not_registered';

export class GoogleSignInError extends Error {
  constructor(readonly code: GoogleFailure) {
    super(code);
  }
}

const b64url = (buf: Buffer) => buf.toString('base64url');

/**
 * Google sign-in with the authorization-code flow, state and PKCE.
 * Only an existing, active user whose verified Google email matches can sign in; nobody is created here.
 */
@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get clientId() { return this.config.get<string>('GOOGLE_CLIENT_ID', '').trim(); }
  private get clientSecret() { return this.config.get<string>('GOOGLE_CLIENT_SECRET', '').trim(); }

  get publicUrl(): string {
    return this.config.get<string>('PUBLIC_URL', 'http://localhost:4200').replace(/\/+$/, '');
  }

  private get redirectUri() { return `${this.publicUrl}/api/auth/google/callback`; }

  enabled(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private sign(data: string): string {
    return b64url(createHmac('sha256', requireSecret(this.config, 'JWT_SECRET')).update(`google-flow:${data}`).digest());
  }

  /** Returns Google's consent URL and the signed cookie holding state and the PKCE verifier. */
  start(): { url: string; cookie: string } {
    const state = b64url(randomBytes(24));
    const verifier = b64url(randomBytes(48));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const body = b64url(Buffer.from(JSON.stringify({ s: state, v: verifier, e: Date.now() + FLOW_TTL_MS })));
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return { url: `${AUTH_URL}?${params}`, cookie: `${body}.${this.sign(body)}` };
  }

  private readFlow(cookie: string | undefined, state: string): string {
    const [body, mac] = String(cookie ?? '').split('.');
    if (!body || !mac) throw new GoogleSignInError('google_state');
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new GoogleSignInError('google_state');
    const flow = JSON.parse(Buffer.from(body, 'base64url').toString()) as { s: string; v: string; e: number };
    if (flow.e < Date.now() || flow.s !== state) throw new GoogleSignInError('google_state');
    return flow.v;
  }

  /** Exchanges the code and returns the id of the matching Paarvix user. */
  async finish(params: { code?: string; state?: string; error?: string }, cookie: string | undefined): Promise<string> {
    if (params.error) throw new GoogleSignInError('google_denied');
    if (!params.code || !params.state) throw new GoogleSignInError('google_state');
    const verifier = this.readFlow(cookie, params.state);

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      this.logger.warn(`Google token exchange failed with HTTP ${tokenRes.status}`);
      throw new GoogleSignInError('google_exchange');
    }
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new GoogleSignInError('google_exchange');

    // The profile comes straight from Google over TLS with the token we just received, so it is trusted.
    const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(10_000) });
    if (!infoRes.ok) throw new GoogleSignInError('google_exchange');
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
    if (!info.email || info.email_verified !== true) throw new GoogleSignInError('google_unverified');

    const user = await this.prisma.user.findUnique({ where: { email: info.email.trim().toLowerCase() } });
    if (!user || !user.isActive) {
      this.logger.log('Google sign-in refused: no active Paarvix user with that email');
      throw new GoogleSignInError('google_not_registered');
    }
    return user.id;
  }
}
