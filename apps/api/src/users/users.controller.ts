/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { type CreateUserInput, type UpdateUserInput, UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../access/permissions.guard';
import { type AuthUser, CurrentUser } from '../access/auth-user';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('users:read')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @RequirePermissions('users:write')
  create(@Body() body: CreateUserInput, @CurrentUser() user: AuthUser) {
    return this.usersService.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  update(@Param('id') id: string, @Body() body: UpdateUserInput, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, body, user);
  }

  @Post(':id/password')
  @RequirePermissions('users:write')
  setPassword(@Param('id') id: string, @Body() body: { password: string }, @CurrentUser() user: AuthUser) {
    return this.usersService.setPassword(id, body?.password, user);
  }

  @Get(':id/sessions')
  @RequirePermissions('users:read')
  sessions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.listSessions(id, user);
  }

  @Post(':id/sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users:write')
  revokeSessions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.revokeSessions(id, user);
  }
}
