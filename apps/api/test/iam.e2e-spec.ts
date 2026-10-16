import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { withTenantContext } from '@hris/database';
import { ACTIONS, RESOURCES } from '@hris/shared-types';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for Phase 3 IAM: the opaque-session pipeline (ADR 0010), the RBAC
 * enforcement chain (AuthenticationGuard -> AuthorizationGuard), and the Administration
 * commands users/roles/permissions/settings/logs.
 *
 * The application is configured through the very same `configureApp` used by `main.ts`;
 * the database is the real docker-backed PostgreSQL used by the other suites.
 */
describe('IAM (e2e)', () => {
  let app: INestApplication;
  let companyId: string;

  const adminEmail = `admin-${randomUUID().slice(0, 8)}@hris.test`;
  const adminPassword = 'Str0ng-Passw0rd!';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    // The e2e suite shares one loopback address; keep the per-IP sign-in limit out of
    // the way without disabling the mechanism entirely.
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, moduleFixture.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, {
      adminEmail,
      adminPassword,
    });
    companyId = tenant.companyId;
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  async function loginAs(
    email: string,
    password: string,
  ): Promise<{ token: string; setCookie: string[] }> {
    const response = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.token).toBe('string');
    expect(response.headers['set-cookie']).toBeDefined();
    const rawCookie = response.headers['set-cookie'];
    const setCookie = Array.isArray(rawCookie) ? rawCookie : rawCookie ? [rawCookie] : [];
    return { token: response.body.data.token as string, setCookie };
  }

  function bearer(token: string) {
    return (req: request.Test): request.Test => req.set('Authorization', `Bearer ${token}`);
  }

  describe('authentication gate', () => {
    it('rejects an unauthenticated request with the standard 401 envelope', async () => {
      const response = await api().get('/api/v1/auth/me').expect(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHENTICATED' },
      });
    });

    it('rejects a login with a wrong password using the generic message', async () => {
      const response = await api()
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'Wrong-Password1' })
        .expect(401);
      expect(response.body.error.message).toBe('Invalid email or password.');
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('session lifecycle', () => {
    let token: string;

    it('mints a session on login', async () => {
      const result = await loginAs(adminEmail, adminPassword);
      token = result.token;
      expect(result.setCookie.join(';')).toContain('hris_session');
    });

    it('resolves /auth/me from the bearer token with roles and permissions', async () => {
      const response = await bearer(token)(api().get('/api/v1/auth/me')).expect(200);
      const me = response.body.data as {
        user: { email: string; status: string; roles: readonly { key: string }[] };
        permissions: readonly {
          resource: string;
          action: string;
          scope: string;
        }[];
      };
      expect(me.user.email).toBe(adminEmail);
      expect(me.user.roles).toContainEqual({ key: 'SYSTEM_ADMIN', name: 'System Administrator' });
      expect(me.permissions).toContainEqual({
        resource: 'user',
        action: 'create',
        scope: 'GLOBAL',
      });
      expect(me.permissions).toContainEqual({
        resource: 'setting',
        action: 'manage',
        scope: 'GLOBAL',
      });
    });

    it('lists sessions and reports the current one', async () => {
      const response = await bearer(token)(api().get('/api/v1/auth/sessions')).expect(200);
      const sessions = response.body.data as { isCurrent: boolean }[];
      const current = sessions.filter((session) => session.isCurrent);
      expect(current.length).toBe(1);
    });

    it('revokes another session', async () => {
      const second = await loginAs(adminEmail, adminPassword);
      const list = await bearer(token)(api().get('/api/v1/auth/sessions')).expect(200);
      const sessions = list.body.data as { id: string; isCurrent: boolean }[];
      const elsewhere = sessions.find((session) => !session.isCurrent);
      expect(elsewhere).toBeDefined();

      const revoked = await bearer(token)(
        api().delete(`/api/v1/auth/sessions/${(elsewhere as { id: string }).id}`),
      ).expect(200);

      // The revoked session's token must now fail, even for a resource it could reach before.
      await bearer(second.token)(api().get('/api/v1/auth/me')).expect(401);
      void revoked;
    });

    it('requires the same-origin header for cookie-authenticated state changes', async () => {
      const loginResponse = await api()
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);
      const cookie = (
        Array.isArray(loginResponse.headers['set-cookie'])
          ? loginResponse.headers['set-cookie'][0]
          : loginResponse.headers['set-cookie']
      ) as string;

      await api().post('/api/v1/auth/logout').set('Cookie', cookie).expect(403);
    });

    it('logs out and invalidates the session', async () => {
      const fresh = await loginAs(adminEmail, adminPassword);
      await bearer(fresh.token)(api().post('/api/v1/auth/logout')).expect(200);
      await bearer(fresh.token)(api().get('/api/v1/auth/me')).expect(401);
    });
  });

  describe('authorisation gate', () => {
    it('denies a capability the caller does not have', async () => {
      // A newly created user has no grants at all (only SYSTEM_ADMIN is seeded with
      // grants), so even role.view must be refused.
      const { token } = await loginAs(adminEmail, adminPassword);

      const officerEmail = `officer-${randomUUID().slice(0, 8)}@hris.test`;
      await bearer(token)(api().post('/api/v1/users'))
        .send({
          email: officerEmail,
          displayName: 'HR Officer',
          password: 'Str0ng-Passw0rd!',
          roleIds: [],
        })
        .expect(200);

      const officerSession = await loginAs(officerEmail, 'Str0ng-Passw0rd!');
      const response = await bearer(officerSession.token)(api().get('/api/v1/roles')).expect(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('administration commands', () => {
    let token: string;

    beforeAll(async () => {
      token = (await loginAs(adminEmail, adminPassword)).token;
    });

    it('lists users and searches by name', async () => {
      const page = await bearer(token)(api().get('/api/v1/users')).expect(200);
      expect(page.body.data.items.length).toBeGreaterThanOrEqual(1);

      const search = await bearer(token)(
        api().get('/api/v1/users').query({ search: 'E2E Administrator' }),
      ).expect(200);
      const items = search.body.data.items as { email: string }[];
      expect(items.some((item) => item.email === adminEmail)).toBe(true);
    });

    it('creates an active user that can sign in with the password set by the admin', async () => {
      const email = `crew-${randomUUID().slice(0, 8)}@hris.test`;
      const create = await bearer(token)(api().post('/api/v1/users'))
        .send({
          email,
          displayName: 'Crew Member',
          password: 'Str0ng-Passw0rd!',
          roleIds: [],
        })
        .expect(200);
      expect(create.body.data.status).toBe('ACTIVE');

      const session = await loginAs(email, 'Str0ng-Passw0rd!');
      const me = await bearer(session.token)(api().get('/api/v1/auth/me')).expect(200);
      expect((me.body.data as { user: { status: string } }).user.status).toBe('ACTIVE');
    });

    it('does not allow a duplicate email', async () => {
      const email = `dup-${randomUUID().slice(0, 8)}@hris.test`;
      await bearer(token)(api().post('/api/v1/users'))
        .send({
          email,
          displayName: 'Dup',
          password: 'Str0ng-Passw0rd!',
          roleIds: [],
        })
        .expect(200);
      await bearer(token)(api().post('/api/v1/users'))
        .send({
          email,
          displayName: 'Dup Two',
          password: 'Str0ng-Passw0rd!',
          roleIds: [],
        })
        .expect(409);
    });

    it('suspends a user and blocks sign-in', async () => {
      const email = `away-${randomUUID().slice(0, 8)}@hris.test`;
      const create = await bearer(token)(api().post('/api/v1/users'))
        .send({
          email,
          displayName: 'Away',
          password: 'Str0ng-Passw0rd!',
          roleIds: [],
        })
        .expect(200);
      const userId = create.body.data.id as string;

      await bearer(token)(api().post(`/api/v1/users/${userId}/status`))
        .send({ status: 'SUSPENDED' })
        .expect(200);

      const suspended = await api()
        .post('/api/v1/auth/login')
        .send({ email, password: 'Str0ng-Passw0rd!' })
        .expect(401);
      expect(suspended.body.error.message).toBe('Invalid email or password.');
    });

    it('lists roles with member and grant counts', async () => {
      const page = await bearer(token)(api().get('/api/v1/roles')).expect(200);
      const roles = page.body.data as { key: string; isSystem: boolean; permissionCount: number }[];
      const admin = roles.find((role) => role.key === 'SYSTEM_ADMIN');
      const adminShape = admin as { isSystem: boolean; permissionCount: number };
      expect(admin).toBeDefined();
      expect(adminShape.isSystem).toBe(true);
      expect(adminShape.permissionCount).toBeGreaterThan(0);
    });

    it('creates, grants and updates a custom role, then deletes it', async () => {
      const create = await bearer(token)(api().post('/api/v1/roles'))
        .send({
          key: 'PAYSLIP_READER',
          name: 'Payslip Reader',
          description: 'Reads organisation data only.',
          permissions: [
            { resource: 'organization', action: 'view', scope: 'COMPANY' },
            { resource: 'analytics', action: 'view', scope: 'COMPANY' },
          ],
        })
        .expect(200);
      const roleId = create.body.data.id as string;

      const detail = await bearer(token)(api().get(`/api/v1/roles/${roleId}`)).expect(200);
      expect((detail.body.data as { grants: unknown[] }).grants.length).toBe(2);

      const replace = await bearer(token)(api().put(`/api/v1/roles/${roleId}/permissions`))
        .send({
          permissions: [{ resource: 'organization', action: 'view', scope: 'COMPANY' }],
        })
        .expect(200);
      expect((replace.body.data as { permissionCount: number }).permissionCount).toBe(1);

      await bearer(token)(api().patch(`/api/v1/roles/${roleId}`))
        .send({ name: 'Payslip Reader (Read Only)', description: 'Updated.' })
        .expect(200);

      await bearer(token)(api().delete(`/api/v1/roles/${roleId}`)).expect(200);
    });

    it('refuses to edit a system role', async () => {
      const roles = await bearer(token)(api().get('/api/v1/roles')).expect(200);
      const admin = (roles.body.data as { key: string; id: string }[]).find(
        (role) => role.key === 'SYSTEM_ADMIN',
      );
      expect(admin).toBeDefined();
      const response = await bearer(token)(
        api().delete(`/api/v1/roles/${(admin as { id: string }).id}`),
      ).expect(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('serves the full permission matrix', async () => {
      const page = await bearer(token)(api().get('/api/v1/permissions')).expect(200);
      const permissions = page.body.data as { resource: string; action: string }[];
      expect(permissions).toContainEqual(
        expect.objectContaining({ resource: 'setting', action: 'manage' }),
      );

      // The matrix is generated from the registry (`resource_definitions` ×
      // `registered_actions`), so it now includes resources beyond the shared bootstrap
      // constants (for example the example Projects application). Derive the expected
      // size from the registry rather than from `RESOURCES`, which is only the bootstrap.
      const registry = await bearer(token)(api().get('/api/v1/platform/registry/resources')).expect(
        200,
      );
      const expected = (registry.body.data as { actions: { action: string }[] }[]).reduce(
        (total, resource) =>
          total +
          resource.actions.filter((entry) => (ACTIONS as readonly string[]).includes(entry.action))
            .length,
        0,
      );
      expect(permissions.length).toBe(expected);
      for (const resource of RESOURCES) {
        expect(permissions.some((permission) => permission.resource === resource)).toBe(true);
      }
    });
  });

  describe('settings', () => {
    let token: string;

    beforeAll(async () => {
      token = (await loginAs(adminEmail, adminPassword)).token;
      const prisma = app.get(PrismaService);
      const client = prisma.getClient();
      await withTenantContext(client, companyId, (tx) =>
        tx.systemSetting.create({
          data: {
            companyId,
            group: 'general',
            key: 'company.displayName',
            value: 'PT Contoh',
            valueType: 'STRING',
            isSensitive: false,
            description: 'The name shown to employees.',
          },
        }),
      );
      await withTenantContext(client, companyId, (tx) =>
        tx.systemSetting.create({
          data: {
            companyId,
            group: 'email',
            key: 'email.smtpPassword',
            value: 's3cret-value',
            valueType: 'STRING',
            isSensitive: true,
            description: 'SMTP password.',
          },
        }),
      );
    });

    it('lists settings, masking sensitive values', async () => {
      const page = await bearer(token)(api().get('/api/v1/settings/general')).expect(200);
      const settings = page.body.data as { key: string; value: string | null }[];
      const name = settings.find((setting) => setting.key === 'company.displayName');
      expect(name?.value).toBe('PT Contoh');

      const email = await bearer(token)(api().get('/api/v1/settings/email')).expect(200);
      const password = (
        email.body.data as { key: string; isSensitive: boolean; value: string | null }[]
      ).find((setting) => setting.key === 'email.smtpPassword');
      const passwordShape = password as { isSensitive: boolean; value: string | null };
      expect(password).toBeDefined();
      expect(passwordShape.isSensitive).toBe(true);
      expect(passwordShape.value).not.toContain('s3cret');
    });

    it('updates a plain setting', async () => {
      const update = await bearer(token)(api().put('/api/v1/settings'))
        .send({
          items: [{ key: 'company.displayName', value: 'PT Contoh Baru' }],
        })
        .expect(200);
      expect(
        (update.body.data as { key: string; value: string }[]).find(
          (setting) => setting.key === 'company.displayName',
        )?.value,
      ).toBe('PT Contoh Baru');
    });

    it('rejects an unknown setting key', async () => {
      const response = await bearer(token)(api().put('/api/v1/settings'))
        .send({ items: [{ key: 'company.nonsense', value: 'x' }] })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('logs', () => {
    let token: string;

    beforeAll(async () => {
      token = (await loginAs(adminEmail, adminPassword)).token;
    });

    it('serves the operational event log', async () => {
      const page = await bearer(token)(api().get('/api/v1/logs')).expect(200);
      const events = page.body.data.items as { category: string; eventType: string }[];
      expect(events.some((event) => event.eventType === 'user.login')).toBe(true);
    });

    it('serves the hash-chained audit trail', async () => {
      const page = await bearer(token)(api().get('/api/v1/logs/audit')).expect(200);
      const rows = page.body.data.items as { entryHash: string; chainVerified: boolean }[];
      for (const row of rows) {
        expect(row.chainVerified).toBe(true);
      }
    });
  });
});
