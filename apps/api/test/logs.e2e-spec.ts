import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PasswordService } from '../src/common/auth/password.service';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for the record scope on the audit-log read surface.
 *
 * Log rows carry no organizational dimension, so only `all` (the whole tenant) and
 * `self` (the caller's own activity) are honourable; a `SELF` grant must not see another
 * actor's events or audit rows. A negative assertion guards the widening regression.
 */
describe('Audit log data scope (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `log-admin-${suffix}@acme.test`;
  const selfEmail = `log-self-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';
  const selfRoleKey = `AUDIT_SELF_${suffix.toUpperCase()}`;

  let companyId = '';
  let adminId = '';
  let selfId = '';
  let adminToken = '';
  let selfToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = tenant.companyId;
    adminId = tenant.adminId;

    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const client = prisma.getClient();
    const hash = await passwords.hashPassword(password);

    await withTenantContext(client, companyId, async (tx) => {
      const self = await tx.user.create({
        data: {
          companyId,
          email: selfEmail,
          displayName: 'Self reader',
          status: 'ACTIVE',
          passwordHash: hash,
          hasVerifiedEmail: true,
        },
      });
      selfId = self.id;

      const role = await tx.role.create({
        data: { key: selfRoleKey, name: 'Audit self reader', description: '', isSystem: false },
      });
      const view = await tx.permission.findUniqueOrThrow({ where: { key: 'audit-log.view' } });
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: view.id, dataScope: 'SELF' },
      });
      await tx.userRole.create({ data: { userId: self.id, roleId: role.id, companyId } });
    });

    const login = async (email: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return response.body.data.token as string;
    };
    adminToken = await login(adminEmail);
    selfToken = await login(selfEmail);
  });

  afterAll(async () => {
    // The role is platform-wide; remove it so it cannot skew global counts on a rerun.
    await app
      .get(PrismaService)
      .getClient()
      .role.deleteMany({ where: { key: selfRoleKey } });
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('returns the whole tenant to a GLOBAL reader', async () => {
    const response = await api().get('/api/v1/logs').set(bearer(adminToken)).expect(200);
    const actors = (response.body.data.items as { actorUserId: string | null }[]).map(
      (row) => row.actorUserId,
    );
    expect(actors).toContain(adminId);
    expect(actors).toContain(selfId);
  });

  it('narrows a SELF-scoped reader to their own events', async () => {
    const response = await api().get('/api/v1/logs').set(bearer(selfToken)).expect(200);
    const items = response.body.data.items as { actorUserId: string | null }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((row) => row.actorUserId === selfId)).toBe(true);
  });

  it('refuses a SELF-scoped reader another actor’s filter', async () => {
    const response = await api()
      .get(`/api/v1/logs?actorUserId=${adminId}`)
      .set(bearer(selfToken))
      .expect(200);
    expect((response.body.data.items as unknown[]).length).toBe(0);
  });

  it('narrows a SELF-scoped reader’s audit trail to their own rows', async () => {
    const response = await api().get('/api/v1/logs/audit').set(bearer(selfToken)).expect(200);
    const items = response.body.data.items as { actorUserId: string | null }[];
    expect(items.every((row) => row.actorUserId === selfId)).toBe(true);
  });
});
