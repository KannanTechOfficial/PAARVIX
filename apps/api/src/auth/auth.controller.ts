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
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupDto } from './dto/setup.dto';
import { JwtAuthGuard } from './auth.guard';
import { GoogleService, GoogleSignInError } from './google.service';
import { type AuthUser, CurrentUser } from '../access/auth-user';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleService,
  ) {}

  private setRefreshCookie(res: FastifyReply, token: string) {
    res.setCookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });
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
      const result = await this.authService.issue(userId);
      this.setRefreshCookie(res, result.refreshToken);
      return res.redirect(`${base}/login#google=${encodeURIComponent(result.accessToken)}`, 302);
    } catch (e) {
      const code = e instanceof GoogleSignInError ? e.code : 'google_exchange';
      return res.redirect(`${base}/login?error=${code}`, 302);
    }
  }

  @Post('setup')
  async setup(@Body() dto: SetupDto, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.authService.setup(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  /** Renews the 15-minute access token from the httpOnly refresh cookie, and rotates the cookie. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const cookie = (req as { cookies?: Record<string, string> }).cookies?.refresh_token;
    try {
      const result = await this.authService.refresh(cookie);
      this.setRefreshCookie(res, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user };
    } catch (e) {
      res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
      throw e;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.authService.login(dto, req.ip);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out' };
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
