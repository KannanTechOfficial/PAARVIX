/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResult, QuerySpec } from '@paarvix/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DatasourcesService } from '../datasources/datasources.service';
import { assertSpecShape } from '../datasources/query-compiler';
import { type AuthUser, can, toSecurityContext } from '../access/auth-user';

export type QueryKind = 'builder' | 'sql';

export interface RunInput {
  datasourceId: string;
  kind: QueryKind;
  spec?: QuerySpec;
  sql?: string;
}

export interface SaveInput extends RunInput {
  name: string;
  description?: string;
  visibility?: 'private' | 'shared';
}

const HISTORY_KEEP = 50;
const MAX_SQL = 100_000;

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datasources: DatasourcesService,
  ) {}

  private clean(input: RunInput): { datasourceId: string; kind: QueryKind; spec: QuerySpec | null; sql: string | null } {
    const datasourceId = String(input?.datasourceId ?? '');
    if (!datasourceId) throw new BadRequestException('Choose a data source');
    if (input.kind === 'sql') {
      const sql = String(input.sql ?? '');
      if (!sql.trim()) throw new BadRequestException('Write a SELECT query first');
      if (sql.length > MAX_SQL) throw new BadRequestException('This query is too long');
      return { datasourceId, kind: 'sql', spec: null, sql };
    }
    if (input.kind !== 'builder') throw new BadRequestException('Unknown query type');
    assertSpecShape(input.spec);
    return { datasourceId, kind: 'builder', spec: input.spec, sql: null };
  }

  /** Runs a query for the user, after the same access checks as the data source routes, and records it in their history. */
  async run(input: RunInput, user: AuthUser): Promise<QueryResult & { durationMs: number }> {
    const q = this.clean(input);
    await this.datasources.assertCanUse(q.datasourceId, user);
    const ctx = toSecurityContext(user);
    const started = Date.now();
    try {
      const result = q.kind === 'sql'
        ? await this.datasources.query(q.datasourceId, q.sql!, [], ctx)
        : await this.datasources.data(q.datasourceId, q.spec!, ctx);
      const durationMs = Date.now() - started;
      await this.remember(user.id, q, result.rows.length, durationMs, null);
      return { ...result, durationMs };
    } catch (e) {
      const message = e instanceof HttpException ? String((e.getResponse() as { message?: unknown }).message ?? e.message) : 'Query failed';
      await this.remember(user.id, q, 0, Date.now() - started, message.slice(0, 500));
      throw e;
    }
  }

  private async remember(userId: string, q: ReturnType<QueriesService['clean']>, rowCount: number, durationMs: number, error: string | null) {
    try {
      await this.prisma.queryRun.create({
        data: {
          userId,
          datasourceId: q.datasourceId,
          kind: q.kind,
          querySpec: q.spec ? (q.spec as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          sql: q.sql,
          rowCount,
          durationMs,
          error,
        },
      });
      const old = await this.prisma.queryRun.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: HISTORY_KEEP,
        select: { id: true },
      });
      if (old.length) await this.prisma.queryRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    } catch {
      // History is a convenience: a failure to record it never fails the query.
    }
  }

  history(user: AuthUser) {
    return this.prisma.queryRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_KEEP,
      include: { datasource: { select: { name: true } } },
    });
  }

  async clearHistory(user: AuthUser) {
    await this.prisma.queryRun.deleteMany({ where: { userId: user.id } });
    return { cleared: true };
  }

  /** Own queries, plus shared ones on sources the user may use. */
  async list(user: AuthUser) {
    const all = await this.prisma.query.findMany({
      where: { OR: [{ createdBy: user.id }, { visibility: 'shared' }] },
      orderBy: { updatedAt: 'desc' },
      include: { datasource: { select: { name: true, type: true } }, creator: { select: { name: true } } },
    });
    const usable: typeof all = [];
    for (const q of all) {
      if (q.createdBy === user.id) {
        usable.push(q);
        continue;
      }
      try {
        await this.datasources.assertCanUse(q.datasourceId, user);
        usable.push(q);
      } catch {
        /* shared on a source this person cannot use */
      }
    }
    return usable;
  }

  private async owned(id: string, user: AuthUser) {
    const q = await this.prisma.query.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Query not found');
    if (q.createdBy !== user.id && !user.isSuperAdmin) throw new ForbiddenException('Only the person who saved this query can change it');
    return q;
  }

  private meta(input: SaveInput) {
    const name = String(input?.name ?? '').trim();
    if (name.length < 2 || name.length > 100) throw new BadRequestException('Name must be 2 to 100 characters');
    const visibility = input.visibility === 'shared' ? 'shared' : 'private';
    return { name, description: String(input.description ?? '').trim().slice(0, 300), visibility };
  }

  async create(input: SaveInput, user: AuthUser) {
    const q = this.clean(input);
    await this.datasources.assertCanUse(q.datasourceId, user);
    if (q.kind === 'sql' && !can(user, 'datasources:query')) throw new ForbiddenException('You cannot save SQL queries');
    return this.prisma.query.create({
      data: {
        ...this.meta(input),
        kind: q.kind,
        datasourceId: q.datasourceId,
        querySpec: (q.spec ?? {}) as unknown as Prisma.InputJsonValue,
        sql: q.sql,
        createdBy: user.id,
      },
    });
  }

  async update(id: string, input: SaveInput, user: AuthUser) {
    await this.owned(id, user);
    const q = this.clean(input);
    await this.datasources.assertCanUse(q.datasourceId, user);
    return this.prisma.query.update({
      where: { id },
      data: {
        ...this.meta(input),
        kind: q.kind,
        datasourceId: q.datasourceId,
        querySpec: (q.spec ?? {}) as unknown as Prisma.InputJsonValue,
        sql: q.sql,
      },
    });
  }

  async remove(id: string, user: AuthUser) {
    await this.owned(id, user);
    await this.prisma.query.delete({ where: { id } });
    return { removed: id };
  }
}
