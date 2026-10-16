import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:net';

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
 * End-to-end coverage of the integration registry: authoring integrations, refusing to
 * persist credentials in configuration, running connection tests that record deliveries,
 * and the permission gate on every route.
 */
describe('Integrations (e2e)', () => {
  let app: INestApplication;
  let tcpServer: Server | null = null;
  let tcpPort = 0;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `integration-admin-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let companyId = '';
  let adminToken = '';
  let liveIntegrationId = '';
  let deadIntegrationId = '';
  let webhookIntegrationId = '';

  // A platform-wide role the scope test grants, tracked so it can be removed afterwards.
  let scopeRoleKey: string | null = null;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';
    process.env['WEBHOOK_ENCRYPTION_KEY'] = 'test-webhook-encryption-key';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    companyId = (await provisionTenant(app, { adminEmail, adminPassword: password })).companyId;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = login.body.data.token as string;

    tcpServer = await listenOnRandomPort();
    tcpPort = (tcpServer.address() as { port: number }).port;
  });

  afterAll(async () => {
    if (scopeRoleKey !== null) {
      // Roles are platform-wide; leaving one would skew global role counts for later runs.
      await app
        .get(PrismaService)
        .getClient()
        .role.deleteMany({ where: { key: scopeRoleKey } });
    }
    tcpServer?.close();
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const integrationPath = (id = '') => `/api/v1/integrations${id === '' ? '' : `/${id}`}`;

  it('requires authentication', async () => {
    await api().get(integrationPath()).expect(401);
  });

  it('creates an email integration', async () => {
    const response = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({
        key: `smtp_${suffix}`,
        name: 'Primary relay',
        kind: 'EMAIL',
        provider: 'smtp',
        config: { host: '127.0.0.1', port: tcpPort },
      })
      .expect(201);

    liveIntegrationId = response.body.data.id as string;
    expect(response.body.data.key).toBe(`smtp_${suffix}`);
    expect(response.body.data.kind).toBe('EMAIL');
    expect(response.body.data.status).toBe('UNKNOWN');
    expect(response.body.data.isEnabled).toBe(true);
  });

  it('rejects a duplicate key', async () => {
    await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({ key: `smtp_${suffix}`, name: 'Duplicate', kind: 'EMAIL', provider: 'smtp' })
      .expect(409);
  });

  it('refuses to store credentials in configuration', async () => {
    const response = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({
        key: `secret_${suffix}`,
        name: 'Leaky relay',
        kind: 'EMAIL',
        provider: 'smtp',
        config: { host: 'smtp.example.com', password: 'hunter2' },
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/credential|settings/i);
  });

  it('refuses a kind that has no adapter yet', async () => {
    await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({ key: `bucket_${suffix}`, name: 'Archive', kind: 'OTHER', provider: 'custom' })
      .expect(400);
  });

  it('requires a valid URL when creating a webhook integration', async () => {
    const response = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({ key: `hook_bad_${suffix}`, name: 'Webhook', kind: 'WEBHOOK', provider: 'generic' })
      .expect(400);
    expect(response.body.error.message).toMatch(/config\.url/i);
  });

  it('records a successful connection test', async () => {
    const response = await api()
      .post(`${integrationPath(liveIntegrationId)}/test`)
      .set(asAdmin())
      .expect(200);

    expect(response.body.data.ok).toBe(true);
    expect(response.body.data.status).toBe('CONNECTED');

    const detail = await api().get(integrationPath(liveIntegrationId)).set(asAdmin()).expect(200);
    expect(detail.body.data.status).toBe('CONNECTED');
    expect(detail.body.data.lastCheckedAt).not.toBeNull();
  });

  it('lists the recorded delivery', async () => {
    const response = await api()
      .get(`${integrationPath(liveIntegrationId)}/deliveries`)
      .set(asAdmin())
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].operation).toBe('connection_test');
    expect(response.body.data[0].status).toBe('SUCCEEDED');
  });

  it('records a failed connection test against a closed port', async () => {
    const create = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({
        key: `dead_${suffix}`,
        name: 'Dead relay',
        kind: 'EMAIL',
        provider: 'smtp',
        config: { host: '127.0.0.1', port: tcpPort },
      })
      .expect(201);
    deadIntegrationId = create.body.data.id as string;

    await new Promise<void>((resolve) => tcpServer?.close(() => resolve()));
    tcpServer = null;

    const response = await api()
      .post(`${integrationPath(deadIntegrationId)}/test`)
      .set(asAdmin())
      .expect(200);
    expect(response.body.data.ok).toBe(false);
    expect(response.body.data.status).toBe('DISCONNECTED');

    const deliveries = await api()
      .get(`${integrationPath(deadIntegrationId)}/deliveries`)
      .set(asAdmin())
      .expect(200);
    expect(deliveries.body.data[0].status).toBe('FAILED');
  });

  it('reports a missing relay when nothing is configured', async () => {
    const create = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({
        key: `empty_${suffix}`,
        name: 'Unconfigured relay',
        kind: 'EMAIL',
        provider: 'smtp',
      })
      .expect(201);

    const response = await api()
      .post(`${integrationPath(create.body.data.id as string)}/test`)
      .set(asAdmin())
      .expect(200);
    expect(response.body.data.ok).toBe(false);
    expect(response.body.data.message).toMatch(/no smtp relay/i);
  });

  it('creates a webhook integration subscribed to every event by default', async () => {
    const response = await api()
      .post(integrationPath())
      .set(asAdmin())
      .send({
        key: `hook_${suffix}`,
        name: 'Event sink',
        kind: 'WEBHOOK',
        provider: 'generic',
        config: { url: 'https://events.example.test/hris' },
      })
      .expect(201);

    webhookIntegrationId = response.body.data.id as string;
    expect(response.body.data.secretConfigured).toBe(false);

    const subs = await api()
      .get(`${integrationPath(webhookIntegrationId)}/subscriptions`)
      .set(asAdmin())
      .expect(200);
    expect(subs.body.data).toHaveLength(1);
    expect(subs.body.data[0].eventType).toBe('*');
  });

  it('replaces a webhook subscription set, de-duplicating event types', async () => {
    const response = await api()
      .put(`${integrationPath(webhookIntegrationId)}/subscriptions`)
      .set(asAdmin())
      .send({ events: ['task.completed', 'task.completed', '  ', 'record.approved'] })
      .expect(200);

    const types = (response.body.data as { eventType: string }[]).map((row) => row.eventType);
    expect(types).toEqual(['record.approved', 'task.completed']);
  });

  it('rotates a webhook signing secret and exposes it exactly once', async () => {
    const rotated = await api()
      .post(`${integrationPath(webhookIntegrationId)}/secret`)
      .set(asAdmin())
      .expect(200);
    expect(rotated.body.data.secret).toMatch(/^whsec_/);
    expect(rotated.body.data.rotatedAt).toBeTruthy();

    const detail = await api()
      .get(integrationPath(webhookIntegrationId))
      .set(asAdmin())
      .expect(200);
    expect(detail.body.data.secretConfigured).toBe(true);
    expect(detail.body.data.secret).toBeUndefined();
  });

  it('refuses to rotate a secret for a non-webhook integration', async () => {
    const response = await api()
      .post(`${integrationPath(liveIntegrationId)}/secret`)
      .set(asAdmin())
      .expect(400);
    expect(response.body.error.message).toMatch(/webhook/i);
  });

  it('updates an integration', async () => {
    const response = await api()
      .patch(integrationPath(liveIntegrationId))
      .set(asAdmin())
      .send({ name: 'Renamed relay', isEnabled: false })
      .expect(200);
    expect(response.body.data.name).toBe('Renamed relay');
    expect(response.body.data.isEnabled).toBe(false);
  });

  it('soft-deletes an integration', async () => {
    await api().delete(integrationPath(deadIntegrationId)).set(asAdmin()).expect(204);
    await api().get(integrationPath(deadIntegrationId)).set(asAdmin()).expect(404);

    const list = await api().get(integrationPath()).set(asAdmin()).expect(200);
    const ids = (list.body.data as { id: string }[]).map((item) => item.id);
    expect(ids).not.toContain(deadIntegrationId);
  });

  it('forbids a user without the permission', async () => {
    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);

    const email = `integration-nobody-${suffix}@acme.test`;
    const hash = await passwords.hashPassword(password);

    await withTenantContext(prisma.getClient(), companyId, (tx) =>
      tx.user.create({
        data: {
          companyId,
          email,
          displayName: 'No role',
          status: 'ACTIVE',
          passwordHash: hash,
          hasVerifiedEmail: true,
        },
      }),
    );

    const login = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    const token = login.body.data.token as string;

    await api()
      .get(integrationPath())
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
  });

  /**
   * Proves the record-level scope resolver is reusable outside `user.view`.
   *
   * A `SELF` grant on `integration.view` must narrow the list to rows the caller created,
   * even though the capability itself is held — the same contract the generic records
   * layer and the user directory honour.
   */
  it('narrows a SELF-scoped reader to the integrations they created', async () => {
    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const client = prisma.getClient();
    const hash = await passwords.hashPassword(password);

    const selfEmail = `integration-self-${suffix}@acme.test`;
    const otherEmail = `integration-other-${suffix}@acme.test`;
    const selfKey = `self_${suffix}`;
    const otherKey = `other_${suffix}`;
    const roleKey = `INTEGRATION_SELF_${suffix.toUpperCase()}`;
    scopeRoleKey = roleKey;

    let otherIntegrationId = '';

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
      const other = await tx.user.create({
        data: {
          companyId,
          email: otherEmail,
          displayName: 'Other owner',
          status: 'ACTIVE',
          passwordHash: hash,
          hasVerifiedEmail: true,
        },
      });

      const role = await tx.role.create({
        data: {
          key: roleKey,
          name: 'Integration self reader',
          description: '',
          isSystem: false,
        },
      });
      const view = await tx.permission.findUniqueOrThrow({ where: { key: 'integration.view' } });
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: view.id, dataScope: 'SELF' },
      });
      await tx.userRole.create({ data: { userId: self.id, roleId: role.id, companyId } });

      await tx.integration.create({
        data: {
          companyId,
          key: selfKey,
          name: 'Mine',
          kind: 'EMAIL',
          provider: 'smtp',
          createdBy: self.id,
        },
      });
      const theirRow = await tx.integration.create({
        data: {
          companyId,
          key: otherKey,
          name: 'Theirs',
          kind: 'EMAIL',
          provider: 'smtp',
          createdBy: other.id,
        },
      });
      otherIntegrationId = theirRow.id;
    });

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: selfEmail, password })
      .expect(200);
    const token = login.body.data.token as string;
    const asSelf = { Authorization: `Bearer ${token}` };

    const list = await api().get(integrationPath()).set(asSelf).expect(200);
    const keys = (list.body.data as { key: string }[]).map((row) => row.key);
    expect(keys).toContain(selfKey);
    expect(keys).not.toContain(otherKey);

    // Reading another owner's integration is a 404, not a 403: the SELF predicate removes
    // the row before the handler sees it, so the caller cannot even probe for its existence.
    await api().get(integrationPath(otherIntegrationId)).set(asSelf).expect(404);
  });
});

function listenOnRandomPort(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
