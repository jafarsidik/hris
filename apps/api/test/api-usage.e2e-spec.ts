import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';

import { AppModule } from '../src/app.module';
import type { AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for developer API usage.
 *
 * A request made with an API key is recorded as one append-only row on the response's
 * finishing edge, so a failed call is stored with the status the client actually saw.
 * The rollup is computed on read, and the request log is tenant-scoped and cursor
 * paginated like every other list.
 */
describe('Developer API usage (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `api-usage-admin-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let companyId = '';
  let adminToken = '';

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['API_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const provisioned = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = provisioned.companyId;

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = login.body.data.token as string;
  });

  afterAll(async () => {
    const client = app.get(PrismaService).getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.apiRequestLog.deleteMany({ where: { companyId } });
      await tx.apiClient.deleteMany({ where: { companyId } });
    });
    await app.close();
  });

  async function createClient(scopes: string[]): Promise<{ id: string; key: string }> {
    const response = await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name: `Usage client ${randomUUID().slice(0, 6)}`, scopes })
      .expect(201);
    return { id: response.body.data.id as string, key: response.body.data.secret as string };
  }

  async function usage(clientId?: string): Promise<Record<string, unknown>> {
    const query = clientId === undefined ? '' : `?clientId=${clientId}`;
    const response = await api().get(`/api/v1/developers/usage${query}`).set(asAdmin()).expect(200);
    return response.body.data as Record<string, unknown>;
  }

  /** Polls the rollup until it accounts for at least `expected` requests, then returns it. */
  async function waitForRequests(
    clientId: string,
    expected: number,
  ): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const report = await usage(clientId);
      const items = report['items'] as { clientId: string; requestCount: number }[];
      const row = items.find((item) => item.clientId === clientId);
      if (row !== undefined && row.requestCount >= expected) {
        return report;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Usage never reached ${expected} requests for client ${clientId}`);
  }

  it('records a request made with an API key and rolls it up by client', async () => {
    const { id, key } = await createClient(['user.view']);

    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);

    const report = await waitForRequests(id, 1);
    const items = report['items'] as {
      clientId: string;
      requestCount: number;
      errorCount: number;
      avgDurationMs: number | null;
    }[];
    const row = items.find((item) => item.clientId === id);

    expect(row).toBeDefined();
    expect(row?.requestCount).toBe(1);
    expect(row?.errorCount).toBe(0);
    expect(row?.avgDurationMs).toBeGreaterThanOrEqual(0);
    expect(report['totalRequests']).toBeGreaterThanOrEqual(1);
  });

  it('counts an authorisation failure as an error', async () => {
    const { id, key } = await createClient(['user.view']);

    await api()
      .get('/api/v1/roles')
      .set({ Authorization: `Bearer ${key}` })
      .expect(403);

    const report = await waitForRequests(id, 1);
    const items = report['items'] as { clientId: string; errorCount: number }[];
    const row = items.find((item) => item.clientId === id);

    expect(row?.errorCount).toBe(1);
  });

  it('lists recorded requests newest first with the client name and no query string', async () => {
    const { id, key } = await createClient(['user.view']);

    await api()
      .get('/api/v1/users?search=secret')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);

    await waitForRequests(id, 1);

    const listed = await api()
      .get(`/api/v1/developers/requests?clientId=${id}`)
      .set(asAdmin())
      .expect(200);

    const items = listed.body.data.items as Record<string, unknown>[];
    expect(items.length).toBeGreaterThanOrEqual(1);

    const entry = items[0];
    expect(entry?.['clientId']).toBe(id);
    expect(entry?.['method']).toBe('GET');
    expect(entry?.['path']).toBe('/api/v1/users');
    expect(entry?.['statusCode']).toBe(200);
    expect(typeof entry?.['clientName']).toBe('string');
    expect(entry).not.toHaveProperty('query');
  });

  it('paginates the request log with the shared cursor contract', async () => {
    const { id, key } = await createClient(['user.view']);

    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
    await waitForRequests(id, 2);

    const first = await api()
      .get(`/api/v1/developers/requests?clientId=${id}&limit=1`)
      .set(asAdmin())
      .expect(200);

    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.pageInfo.hasNextPage).toBe(true);
    const cursor = first.body.data.pageInfo.endCursor as string;
    expect(typeof cursor).toBe('string');

    const second = await api()
      .get(
        `/api/v1/developers/requests?clientId=${id}&limit=1&cursor=${encodeURIComponent(cursor)}`,
      )
      .set(asAdmin())
      .expect(200);

    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
  });

  it('rejects a cursor that does not belong to the filters', async () => {
    const { id, key } = await createClient(['user.view']);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
    await waitForRequests(id, 1);

    const first = await api()
      .get(`/api/v1/developers/requests?clientId=${id}&limit=1`)
      .set(asAdmin())
      .expect(200);
    const cursor = first.body.data.pageInfo.endCursor as string | null;

    if (cursor !== null) {
      // The same cursor under a different filter set must be refused, not silently used.
      await api()
        .get(`/api/v1/developers/requests?limit=1&cursor=${encodeURIComponent(cursor)}`)
        .set(asAdmin())
        .expect(400);
    }
  });

  it('does not expose usage to another tenant', async () => {
    const { id, key } = await createClient(['user.view']);
    await api()
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
    await waitForRequests(id, 1);

    const otherEmail = `api-usage-other-${randomUUID().slice(0, 8)}@acme.test`;
    await provisionTenant(app, { adminEmail: otherEmail, adminPassword: password });
    const otherLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);
    const otherToken = otherLogin.body.data.token as string;

    const foreign = await api()
      .get('/api/v1/developers/usage')
      .set({ Authorization: `Bearer ${otherToken}` })
      .expect(200);

    const items = foreign.body.data.items as { clientId: string }[];
    expect(items.some((item) => item.clientId === id)).toBe(false);
  });
});
