import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';
import { ACTIONS, RESOURCES } from '@hris/shared-types';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PasswordService } from '../src/common/auth/password.service';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for the platform metadata registry.
 *
 * The registry is platform-wide (no tenant scoping), so these assertions are about the
 * seeded catalogue and about `registry:view` being enforced, not about isolation.
 */
describe('Platform registry (e2e)', () => {
  let app: INestApplication;

  const adminEmail = `registry-admin-${randomUUID().slice(0, 8)}@acme.test`;
  const restrictedEmail = `registry-restricted-${randomUUID().slice(0, 8)}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let adminToken = '';
  let restrictedToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const { companyId } = await provisionTenant(app, { adminEmail, adminPassword: password });

    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const client = prisma.getClient();
    const restrictedHash = await passwords.hashPassword(password);

    await withTenantContext(client, companyId, async (tx) => {
      const employeeRole = await tx.role.findUniqueOrThrow({ where: { key: 'EMPLOYEE' } });
      const userId = randomUUID();
      await tx.user.create({
        data: {
          id: userId,
          companyId,
          email: restrictedEmail,
          displayName: 'Registry Restricted',
          status: 'ACTIVE',
          passwordHash: restrictedHash,
          hasVerifiedEmail: true,
        },
      });
      await tx.userRole.create({ data: { userId, roleId: employeeRole.id, companyId } });
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = adminLogin.body.data.token as string;

    const restrictedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: restrictedEmail, password })
      .expect(200);
    restrictedToken = restrictedLogin.body.data.token as string;
  });

  afterAll(async () => {
    // The registry is platform-wide and writes persist, so remove anything a run
    // registered. Cascades clear the modules, resources, fields and actions.
    await app
      .get(PrismaService)
      .getClient()
      .application.deleteMany({ where: { key: { startsWith: 'e2e-app-' } } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asRestricted = () => ({ Authorization: `Bearer ${restrictedToken}` });

  it('lists the platform application', async () => {
    const response = await api()
      .get('/api/v1/platform/registry/applications')
      .set(asAdmin())
      .expect(200);

    const applications = response.body.data as { key: string; name: string }[];
    // The registry is platform-wide and also carries the example Projects application
    // registered through metadata, so assert the platform app is present rather than
    // that it is the only one.
    expect(applications).toContainEqual(
      expect.objectContaining({ key: 'HRIS', name: 'HRIS Platform' }),
    );
  });

  it('lists every registered module', async () => {
    const response = await api()
      .get('/api/v1/platform/registry/modules')
      .set(asAdmin())
      .expect(200);

    const keys = (response.body.data as { key: string }[]).map((module) => module.key);
    expect(keys).toContain('M00_AUTHENTICATION');
    expect(keys).toContain('PLATFORM');
    expect(keys).toContain('PROJECT_MANAGEMENT');
  });

  it('lists every RBAC resource with its actions', async () => {
    const response = await api()
      .get('/api/v1/platform/registry/resources')
      .set(asAdmin())
      .expect(200);

    const resources = response.body.data as {
      key: string;
      fields: unknown[];
      actions: unknown[];
    }[];
    // Every bootstrap resource is present; the registry may also carry resources
    // registered entirely through metadata (the example Projects application).
    for (const resource of RESOURCES) {
      expect(resources.some((entry) => entry.key === resource)).toBe(true);
    }
    expect(resources.length).toBeGreaterThanOrEqual(RESOURCES.length);

    const user = resources.find((resource) => resource.key === 'user');
    expect(user).toBeDefined();
    expect(user?.fields.length).toBeGreaterThan(0);
    expect(user?.actions).toHaveLength(ACTIONS.length);
  });

  it('returns one resource by key', async () => {
    const response = await api()
      .get('/api/v1/platform/registry/resources/user')
      .set(asAdmin())
      .expect(200);

    expect(response.body.data).toMatchObject({ key: 'user', moduleKey: 'M00_AUTHENTICATION' });
  });

  it('returns 404 for an unknown resource', async () => {
    await api()
      .get('/api/v1/platform/registry/resources/does-not-exist')
      .set(asAdmin())
      .expect(404);
  });

  it('denies a caller without registry:view', async () => {
    await api().get('/api/v1/platform/registry/resources').set(asRestricted()).expect(403);
  });

  describe('write path', () => {
    const suffix = randomUUID().slice(0, 8);
    const appKey = `e2e-app-${suffix}`;
    const moduleKey = `E2E_MOD_${suffix.toUpperCase()}`;
    const resourceKey = `e2e-task-${suffix}`;

    it('registers an application', async () => {
      const response = await api()
        .post('/api/v1/platform/registry/applications')
        .set(asAdmin())
        .send({ key: appKey, name: 'E2E Application', description: 'Temporary' })
        .expect(200);

      expect(response.body.data).toMatchObject({ key: appKey, name: 'E2E Application' });
    });

    it('rejects a duplicate application key', async () => {
      await api()
        .post('/api/v1/platform/registry/applications')
        .set(asAdmin())
        .send({ key: appKey, name: 'Duplicate' })
        .expect(409);
    });

    it('rejects an application key that is not a slug', async () => {
      await api()
        .post('/api/v1/platform/registry/applications')
        .set(asAdmin())
        .send({ key: `${appKey} upper`, name: 'Bad Key' })
        .expect(400);
    });

    it('registers a module under the application', async () => {
      const response = await api()
        .post('/api/v1/platform/registry/modules')
        .set(asAdmin())
        .send({ applicationKey: appKey, key: moduleKey, name: 'E2E Module' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        key: moduleKey,
        applicationId: expect.any(String),
      });
    });

    it('rejects a module under an unknown application', async () => {
      await api()
        .post('/api/v1/platform/registry/modules')
        .set(asAdmin())
        .send({
          applicationKey: 'no-such-app',
          key: `E2E_MISSING_${suffix.toUpperCase()}`,
          name: 'Missing',
        })
        .expect(404);
    });

    it('registers a resource under the module', async () => {
      const response = await api()
        .post('/api/v1/platform/registry/resources')
        .set(asAdmin())
        .send({
          applicationKey: appKey,
          moduleKey,
          key: resourceKey,
          name: 'E2E Task',
          resourceType: 'TRANSACTION',
          supportsCrud: true,
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        key: resourceKey,
        moduleKey,
        supportsCrud: true,
      });
      expect(response.body.data.fields).toHaveLength(0);
      expect(response.body.data.actions).toHaveLength(0);
    });

    it('adds a field to the resource', async () => {
      const response = await api()
        .post(`/api/v1/platform/registry/resources/${resourceKey}/fields`)
        .set(asAdmin())
        .send({ key: 'due-date', label: 'Due date', dataType: 'DATE', required: true })
        .expect(200);

      const fields = response.body.data.fields as { key: string; dataType: string }[];
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({ key: 'due-date', dataType: 'DATE', required: true });
    });

    it('registers a custom action on the resource', async () => {
      const response = await api()
        .post(`/api/v1/platform/registry/resources/${resourceKey}/actions`)
        .set(asAdmin())
        .send({ action: 'approve', name: 'Approve' })
        .expect(200);

      const actions = response.body.data.actions as { action: string; isCustom: boolean }[];
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ action: 'approve', isCustom: true });
    });

    it('returns the registered resource with its field and action', async () => {
      const response = await api()
        .get(`/api/v1/platform/registry/resources/${resourceKey}`)
        .set(asAdmin())
        .expect(200);

      expect(response.body.data).toMatchObject({ key: resourceKey, moduleKey });
      expect(response.body.data.fields).toHaveLength(1);
      expect(response.body.data.actions).toHaveLength(1);
    });

    it('denies a write for a caller without registry:create', async () => {
      await api()
        .post('/api/v1/platform/registry/applications')
        .set(asRestricted())
        .send({ key: `e2e-denied-${suffix}`, name: 'Denied' })
        .expect(403);
    });
  });
});
