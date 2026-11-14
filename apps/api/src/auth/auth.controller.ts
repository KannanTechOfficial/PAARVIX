/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Req,
  Delete,
  Param,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupDto } from './dto/setup.dto';
import { JwtAuthGuard } from './auth.guard';
import { GoogleService, GoogleSignInError } from './google.service';
import { type AuthUser, CurrentUser } from '../access/auth-user';
import { SessionsService, type SessionMeta } from './sessions.service';

/**
 * The refresh cookie is sent to /api/auth/* only (refresh, logout), never to data routes.
 * Older versions used /api/auth/refresh; that cookie is cleared wherever a new one is set,
 * because a browser would otherwise send both and the narrower, stale one first.
 */
const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/api/auth';
const LEGACY_COOKIE_PATH = '/api/auth/refresh';

const cookieOf = (req: FastifyRequest) => (req as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
const metaOf = (req: FastifyRequest): SessionMeta => ({
  ip: req.ip,
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleService,
    private readonly sessions: SessionsService,
  ) {}

  private setRefreshCookie(res: FastifyReply, token: string) {
    res.clearCookie(REFRESH_COOKIE, { path: LEGACY_COOKIE_PATH });
    res.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: Math.floor(this.sessions.maxMs / 1000),
    });
  }

  private clearRefreshCookie(res: FastifyReply) {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    res.clearCookie(REFRESH_COOKIE, { path: LEGACY_COOKIE_PATH });
  }

  @Get('google')
  googleStart(@Res() res: FastifyReply) {
    if (!this.google.enabled()) {
      return res.redirect(`${this.google.publicUrl}/login?error=google_off`, 302);
    }
    const { url, cookie } = this.google.start();
    // Lax, not strict: the cookie must come back on Google's top-level redirect to the callback.
    res.setCookie('pvx_google', cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 600,
    });
    return res.redirect(url, 302);
  }

  /** The access token goes back in the URL fragment, which browsers never send to a server or log. */
  @Get('google/callback')
  async googleCallback(
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    res.clearCookie('pvx_google', { path: '/api/auth/google' });
    const base = this.google.publicUrl;
    try {
      const userId = await this.google.finish(query, (req as { cookies?: Record<string, string> }).cookies?.pvx_google);
      const result = await this.authService.issue(userId, 'google', metaOf(req));
      this.setRefreshCookie(res, result.refreshToken);
      return res.redirect(`${base}/login#google=${encodeURIComponent(result.accessToken)}`, 302);
    } catch (e) {
      const code = e instanceof GoogleSignInError ? e.code : 'google_exchange';
      return res.redirect(`${base}/login?error=${code}`, 302);
    }
  }

  @Post('setup')
  async setup(@Body() dto: SetupDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.authService.setup(dto, metaOf(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  /** Renews the 15-minute access token from the httpOnly refresh cookie, and rotates the cookie. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    try {
      const result = await this.authService.refresh(cookieOf(req), metaOf(req));
      this.setRefreshCookie(res, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.authService.login(dto, req.ip, metaOf(req).userAgent);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    // Ends the session on the server, so a copy of the cookie or the access token stops working too.
    await this.authService.logout(cookieOf(req));
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  /** The browsers and devices the signed-in person is signed in on. */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthUser) {
    return this.sessions.listActive(user.id, user.sessionId);
  }

  /** Signs out every other device, keeping this one. */
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async revokeOthers(@CurrentUser() user: AuthUser) {
    return { ended: await this.sessions.revokeAll(user.id, 'signed_out_elsewhere', user.sessionId) };
  }

  /** Signs out one of the person's own devices. */
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.sessions.revokeOwn(user.id, String(id));
    return { ended: id };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Get('status')
  async status() {
    const setupRequired = await this.authService.isSetupRequired();
    return { setupRequired, googleEnabled: this.google.enabled() };
  }
}
