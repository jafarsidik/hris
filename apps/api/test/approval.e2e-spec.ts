import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for approval-authority configuration.
 *
 * The rules are validated and persisted here; routing real approvals through them is
 * the M07 workflow engine's job, so it is not exercised by this suite.
 */
describe('Approval authority (e2e)', () => {
  let app: INestApplication;

  const email = `approval-admin-${randomUUID().slice(0, 8)}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let companyId = '';
  let adminId = '';
  let adminRoleId = '';
  let delegateeId = '';
  let adminToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, { adminEmail: email, adminPassword: password });
    companyId = tenant.companyId;
    adminId = tenant.adminId;

    const prisma = app.get(PrismaService);
    const client = prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { key: 'SYSTEM_ADMIN' } });
      adminRoleId = role.id;
      delegateeId = randomUUID();
      await tx.user.create({
        data: {
          id: delegateeId,
          companyId,
          email: `delegatee-${randomUUID().slice(0, 8)}@acme.test`,
          displayName: 'E2E Delegatee',
          status: 'ACTIVE',
          hasVerifiedEmail: true,
        },
      });
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    adminToken = login.body.data.token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  it('rejects a limit without a currency', async () => {
    await api()
      .post('/api/v1/approval-authorities')
      .set(asAdmin())
      .send({ subjectType: 'USER', subjectId: adminId, maxAmount: '1000.00' })
      .expect(422);
  });

  it('rejects an unknown subject', async () => {
    await api()
      .post('/api/v1/approval-authorities')
      .set(asAdmin())
      .send({ subjectType: 'USER', subjectId: randomUUID() })
      .expect(422);
  });

  it('creates, updates and deletes an authority rule', async () => {
    const created = await api()
      .post('/api/v1/approval-authorities')
      .set(asAdmin())
      .send({
        subjectType: 'ROLE',
        subjectId: adminRoleId,
        resource: 'claim',
        maxAmount: '2500.50',
        currencyCode: 'IDR',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      subjectType: 'ROLE',
      subjectId: adminRoleId,
      resource: 'claim',
      maxAmount: '2500.5',
      currencyCode: 'IDR',
    });
    const authorityId = created.body.data.id as string;

    const updated = await api()
      .patch(`/api/v1/approval-authorities/${authorityId}`)
      .set(asAdmin())
      .send({ maxAmount: '5000.00' })
      .expect(200);
    expect(updated.body.data.maxAmount).toBe('5000');

    const list = await api().get('/api/v1/approval-authorities').set(asAdmin()).expect(200);
    expect(list.body.data).toHaveLength(1);

    await api().delete(`/api/v1/approval-authorities/${authorityId}`).set(asAdmin()).expect(204);

    const after = await api().get('/api/v1/approval-authorities').set(asAdmin()).expect(200);
    expect(after.body.data).toEqual([]);
  });

  it('refuses a delegation to the same user', async () => {
    await api()
      .post('/api/v1/approval-delegations')
      .set(asAdmin())
      .send({ delegatorUserId: adminId, delegateeUserId: adminId })
      .expect(422);
  });

  it('creates and deletes a delegation', async () => {
    const created = await api()
      .post('/api/v1/approval-delegations')
      .set(asAdmin())
      .send({
        delegatorUserId: adminId,
        delegateeUserId: delegateeId,
        resource: 'leave',
        reason: 'Annual leave',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      delegatorUserId: adminId,
      delegateeUserId: delegateeId,
      resource: 'leave',
      reason: 'Annual leave',
    });

    await api()
      .delete(`/api/v1/approval-delegations/${created.body.data.id}`)
      .set(asAdmin())
      .expect(204);

    const after = await api().get('/api/v1/approval-delegations').set(asAdmin()).expect(200);
    expect(after.body.data).toEqual([]);
  });
});
