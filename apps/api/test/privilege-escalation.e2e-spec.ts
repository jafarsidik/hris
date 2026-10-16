import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for privilege escalation through the IAM write paths.
 *
 * A delegated administrator holds `role.manage`/`user.manage` at COMPANY scope, which is
 * enough to reach the role and user endpoints. The escalation guard must nevertheless
 * refuse every attempt to mint a capability or scope the caller does not themselves
 * hold — either by writing grants onto a role, or by assigning an over-powered role to a
 * user.
 */
describe('Privilege escalation (e2e)', () => {
  let app: INestApplication;

  const password = 'Str0ng-Passw0rd!';
  const suffix = randomUUID().slice(0, 8);

  const adminEmail = `esc-admin-${suffix}@acme.test`;
  const delegateEmail = `esc-delegate-${suffix}@acme.test`;

  const delegateRoleKey = `ESC_DELEGATE_${suffix.toUpperCase()}`;
  const targetRoleKey = `ESC_TARGET_${suffix.toUpperCase()}`;
  const madeRoleKey = `ESC_MADE_${suffix.toUpperCase()}`;

  let adminToken: string;
  let delegateToken: string;
  let delegateUserId: string;
  let targetRoleId: string;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, moduleFixture.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    await provisionTenant(app, { adminEmail, adminPassword: password });

    const api = () => request(app.getHttpServer());
    const login = async (email: string): Promise<string> => {
      const response = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
      return response.body.data.token as string;
    };

    adminToken = await login(adminEmail);

    // SYSTEM_ADMIN creates a delegated role: enough to manage roles and users, but only
    // at COMPANY scope and only within those two resources.
    const delegateRole = await api()
      .post('/api/v1/roles')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        key: delegateRoleKey,
        name: 'Delegated administrator',
        description: 'Manages roles and users within the company.',
        permissions: [
          { resource: 'role', action: 'manage', scope: 'COMPANY' },
          { resource: 'user', action: 'manage', scope: 'COMPANY' },
        ],
      })
      .expect(200);

    // A non-system role the delegate will try to widen past their own authority.
    const targetRole = await api()
      .post('/api/v1/roles')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        key: targetRoleKey,
        name: 'Escalation target',
        description: 'A harmless role that the delegate may not widen.',
        permissions: [{ resource: 'setting', action: 'view', scope: 'COMPANY' }],
      })
      .expect(200);
    targetRoleId = targetRole.body.data.id as string;

    // Create the delegate with the delegated role and an admin-set password, then sign in.
    const created = await api()
      .post('/api/v1/users')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        email: delegateEmail,
        displayName: 'Delegated Admin',
        password,
        roleIds: [delegateRole.body.data.id as string],
      })
      .expect(200);
    delegateUserId = created.body.data.id as string;

    delegateToken = await login(delegateEmail);
  });

  afterAll(async () => {
    // Roles are platform-wide, so clean up this run's roles (and their cascaded grants
    // and memberships) to keep the shared database's global role count stable.
    await app
      .get(PrismaService)
      .getClient()
      .role.deleteMany({
        where: { key: { in: [delegateRoleKey, targetRoleKey, madeRoleKey] } },
      });
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const asDelegate = () => ({ Authorization: `Bearer ${delegateToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  it('refuses to create a role granting a capability the caller does not hold', async () => {
    const response = await api()
      .post('/api/v1/roles')
      .set(asDelegate())
      .send({
        key: madeRoleKey,
        name: 'Escalated role',
        description: 'Attempts to grant setting.manage.',
        permissions: [{ resource: 'setting', action: 'manage', scope: 'COMPANY' }],
      })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses to create a role granting a wider scope than the caller holds', async () => {
    const response = await api()
      .post('/api/v1/roles')
      .set(asDelegate())
      .send({
        key: madeRoleKey,
        name: 'Escalated role',
        description: 'Attempts a GLOBAL grant.',
        permissions: [{ resource: 'role', action: 'manage', scope: 'GLOBAL' }],
      })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows creating a role within the caller’s own authority', async () => {
    await api()
      .post('/api/v1/roles')
      .set(asDelegate())
      .send({
        key: madeRoleKey,
        name: 'Delegated role',
        description: 'Within the delegate’s authority.',
        permissions: [{ resource: 'role', action: 'view', scope: 'COMPANY' }],
      })
      .expect(200);
  });

  it('refuses to widen an existing role past the caller’s scope', async () => {
    const response = await api()
      .put(`/api/v1/roles/${targetRoleId}/permissions`)
      .set(asDelegate())
      .send({ permissions: [{ resource: 'setting', action: 'manage', scope: 'GLOBAL' }] })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses to assign a role the caller could not grant', async () => {
    const roles = await api().get('/api/v1/roles').set(asAdmin()).expect(200);
    const systemAdmin = (roles.body.data as { id: string; key: string }[]).find(
      (role) => role.key === 'SYSTEM_ADMIN',
    );
    expect(systemAdmin).toBeDefined();

    const response = await api()
      .patch(`/api/v1/users/${delegateUserId}`)
      .set(asDelegate())
      .send({ roleIds: [(systemAdmin as { id: string }).id] })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
