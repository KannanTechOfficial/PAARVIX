/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ForbiddenException } from '@nestjs/common';
import type { SecurityContext } from '@paarvix/shared';
import { DatasourcesService } from './datasources.service';

describe('DatasourcesService.query', () => {
  it('refuses raw SQL when row filters apply, before touching the data source', async () => {
    const prisma = { datasource: { findUnique: jest.fn() } };
    const service = new DatasourcesService(prisma as any, {} as any, {} as any, {} as any);
    const ctx: SecurityContext = {
      userId: 'u1',
      role: 'EDITOR',
      tenantId: null,
      rowFilters: [{ column: 'dept', op: 'eq', value: 'x' }],
    };
    await expect(service.query('id1', 'SELECT 1', [], ctx)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.datasource.findUnique).not.toHaveBeenCalled();
  });
});

describe('DatasourcesService secrets', () => {
  const mysql = { secretFields: ['password'], validateConfig: (c: unknown) => c };
  const make = () => {
    const prisma = { datasource: { create: jest.fn(async ({ data }) => ({ id: 'x', ...data })) } };
    const service = new DatasourcesService(prisma as any, { get: () => mysql, allSecretFields: () => new Set(['password', 'serviceAccount']) } as any, {} as any, {} as any);
    return { prisma, service };
  };

  it('rejects a secret that is not a string', async () => {
    const { prisma, service } = make();
    await expect(service.create({ name: 'n', type: 'mysql', config: { password: { a: 1 } }, createdBy: 'u' })).rejects.toThrow('must be text');
    expect(prisma.datasource.create).not.toHaveBeenCalled();
  });

  it('stores a string secret encrypted and returns only a flag', async () => {
    process.env.PAARVIX_ENCRYPTION_KEY = 'test-key-for-unit-tests';
    const { prisma, service } = make();
    const out: any = await service.create({ name: 'n', type: 'mysql', config: { host: 'h', password: 'hunter2' }, createdBy: 'u' });
    expect(prisma.datasource.create.mock.calls[0][0].data.config.password).toBeUndefined();
    expect(out.config).toEqual({ host: 'h', hasPassword: true });
  });

  it('lists a row of an unknown type', () => {
    const { service } = make();
    const row = { type: 'legacy-kind', config: { host: 'h', password: 'x', encryptedToken: 'abc' } };
    expect((service as any).publicView(row).config).toEqual({ host: 'h', hasToken: true });
  });

  it('refuses to remove a source while a sync runs, and removes an unknown-type row otherwise', async () => {
    const prisma = { datasource: { delete: jest.fn() } };
    const store = { dropAll: jest.fn() };
    let running = true;
    const service = new DatasourcesService(prisma as any, { get: () => { throw new Error('unknown type'); } } as any, store as any, { isRunning: () => running } as any);
    await expect(service.remove('x')).rejects.toThrow('Sync is running');
    expect(store.dropAll).not.toHaveBeenCalled();
    running = false;
    await expect(service.remove('x')).resolves.toEqual({ removed: 'x' });
    expect(store.dropAll).toHaveBeenCalledWith('x');
  });

  it('still reads rows saved with the old encryptedPassword key', async () => {
    const { service } = make();
    const row = { type: 'mysql', config: { host: 'h', encryptedPassword: 'abc' } };
    expect((service as any).publicView(row).config).toEqual({ host: 'h', hasPassword: true });
  });
});
