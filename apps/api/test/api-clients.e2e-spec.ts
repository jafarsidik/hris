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
 * End-to-end coverage for developer API clients.
 *
 * The secret is shown once, only its hash is stored, every request re-checks the live
 * client row and scopes, and a key is limited to exactly the scopes it was minted with.
 */
describe('Developer API clients (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `api-client-admin-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let companyId = '';
  let adminToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';
    // Each client has its own counter, so a low ceiling proves the limiter without
    // affecting the single- and few-call clients in the other cases.
    process.env['API_RATE_LIMIT_PER_MINUTE'] = '5';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const provisioned = await provisionTenant(app, {
      adminEmail,
      adminPassword: password,
    });
    companyId = provisioned.companyId;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = login.body.data.token as string;
  });

  afterAll(async () => {
    const client = app.get(PrismaService).getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.apiClient.deleteMany({ where: { companyId } });
    });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  async function createClient(
    scopes: string[],
    name = 'Test client',
  ): Promise<{ id: string; key: string }> {
    const response = await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name, scopes })
      .expect(201);
    return { id: response.body.data.id as string, key: response.body.data.secret as string };
  }

  it('creates a client and returns the secret exactly once', async () => {
    const response = await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name: 'Read only', scopes: ['user.view'] })
      .expect(201);

    expect(response.body.data.secret).toMatch(/^hris_ak_[0-9a-f]{24}\./);
    expect(response.body.data.clientId).toMatch(/^hris_ak_[0-9a-f]{24}$/);
    expect(response.body.data.scopes).toEqual(['user.view']);

    const listed = await api().get('/api/v1/developers/clients').set(asAdmin()).expect(200);
    const row = (listed.body.data as Record<string, unknown>[]).find(
      (item) => item['id'] === response.body.data.id,
    );
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('secret');
    expect(row).not.toHaveProperty('secretHash');
  });

  it('authenticates a request with the API key', async () => {
    const { key } = await createClient(['user.view']);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
  });

  it('denies a scope the client was not granted', async () => {
    const { key } = await createClient(['user.view']);
    await api()
      .get('/api/v1/roles')
      .set({ Authorization: `Bearer ${key}` })
      .expect(403);
  });

  it('rejects an unknown or malformed scope', async () => {
    await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name: 'Bad', scopes: ['not-a-permission'] })
      .expect(400);

    await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name: 'Bad', scopes: ['nope.view'] })
      .expect(400);
  });

  it('rejects a key that was rotated', async () => {
    const { id, key } = await createClient(['user.view']);

    const rotated = await api()
      .post(`/api/v1/developers/clients/${id}/rotate`)
      .set(asAdmin())
      .expect(200);
    const newKey = rotated.body.data.secret as string;
    expect(newKey).not.toBe(key);

    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(401);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${newKey}` })
      .expect(200);
  });

  it('rejects a key once the client is disabled', async () => {
    const { id, key } = await createClient(['user.view']);

    await api()
      .patch(`/api/v1/developers/clients/${id}`)
      .set(asAdmin())
      .send({ isActive: false })
      .expect(200);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(401);
  });

  it('stops accepting a key after the client is deleted', async () => {
    const { id, key } = await createClient(['user.view']);

    await api().delete(`/api/v1/developers/clients/${id}`).set(asAdmin()).expect(204);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(401);
    await api().get(`/api/v1/developers/clients/${id}`).set(asAdmin()).expect(404);
  });

  it('rate limits a client that exceeds its quota', async () => {
    const { key } = await createClient(['user.view']);
    const call = () =>
      api()
        .get('/api/v1/users')
        .set({ Authorization: `Bearer ${key}` });

    for (let i = 0; i < 5; i += 1) {
      await call().expect(200);
    }

    const limited = await call().expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('does not expose a client to another tenant', async () => {
    const { id } = await createClient(['user.view']);

    const otherEmail = `api-client-other-${randomUUID().slice(0, 8)}@acme.test`;
    await provisionTenant(app, { adminEmail: otherEmail, adminPassword: password });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);
    const otherToken = otherLogin.body.data.token as string;

    await api()
      .get(`/api/v1/developers/clients/${id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
      .expect(404);
  });
});
