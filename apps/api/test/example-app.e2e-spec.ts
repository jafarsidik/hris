import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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
 * End-to-end coverage for the Phase 5b example domain application.
 *
 * The "Projects" application is registered entirely through metadata (a seeded
 * application, module, `project`/`task` resources with fields and the standard actions)
 * plus two small pieces of code: a custom `task.complete` action and a `task.completed`
 * consumer. This suite exercises both halves of the extension mechanism end-to-end
 * through the generic records API, proving a domain can be added without touching core.
 */
describe('Example domain application (e2e)', () => {
  let app: INestApplication;
  let companyId = '';

  const suffix = randomUUID().slice(0, 8);
  const noAccessRoleKey = `E2E_EXAMPLE_NONE_${suffix.toUpperCase()}`;
  const password = 'Str0ng-Passw0rd!';
  const adminEmail = `example-admin-${suffix}@acme.test`;
  const noAccessEmail = `example-none-${suffix}@acme.test`;

  let adminToken = '';
  let noAccessToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const provisioned = await provisionTenant(app, {
      adminEmail,
      adminPassword: password,
    });
    companyId = provisioned.companyId;

    const prisma = app.get(PrismaService);
    const client = prisma.getClient();

    // A role with no grants, used to prove the platform enforces authorization on
    // registry-registered resources exactly like it does for bootstrap resources.
    const noAccessRole = await client.role.create({
      data: { key: noAccessRoleKey, name: 'E2E Example No Access', description: 'No grants' },
    });
    const noAccessId = randomUUID();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.user.create({
        data: {
          id: noAccessId,
          companyId,
          email: noAccessEmail,
          displayName: 'E2E Example No Access',
          status: 'ACTIVE',
          passwordHash: await app.get(PasswordService).hashPassword(password),
          hasVerifiedEmail: true,
        },
      });
      await tx.userRole.create({
        data: { userId: noAccessId, roleId: noAccessRole.id, companyId },
      });
    });

    adminToken = await login(adminEmail);
    noAccessToken = await login(noAccessEmail);
  });

  afterAll(async () => {
    const client = app.get(PrismaService).getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.resourceRecord.deleteMany({ where: { companyId } });
    });
    await client.role.deleteMany({ where: { key: noAccessRoleKey } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asNoAccess = () => ({ Authorization: `Bearer ${noAccessToken}` });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.token as string;
  }

  async function createRecord(resource: string, body: Record<string, unknown>): Promise<string> {
    const response = await api()
      .post(`/api/v1/records/${resource}`)
      .set(asAdmin())
      .send(body)
      .expect(201);
    return response.body.data.id as string;
  }

  it('exposes the example application and its resources through the registry', async () => {
    const applications = await api()
      .get('/api/v1/platform/registry/applications')
      .set(asAdmin())
      .expect(200);
    expect(applications.body.data).toContainEqual(
      expect.objectContaining({ key: 'PROJECTS', name: 'Projects' }),
    );

    const resources = await api()
      .get('/api/v1/platform/registry/resources')
      .set(asAdmin())
      .expect(200);
    const rows = resources.body.data as {
      key: string;
      supportsCrud: boolean;
      fields: { key: string }[];
      actions: { action: string; isCustom: boolean }[];
    }[];

    const project = rows.find((row) => row.key === 'project');
    expect(project?.supportsCrud).toBe(true);
    expect(project?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['name', 'status']),
    );

    const task = rows.find((row) => row.key === 'task');
    expect(task?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['title', 'status', 'completedAt']),
    );
    expect(task?.actions).toContainEqual(
      expect.objectContaining({ action: 'complete', isCustom: true, name: 'Complete' }),
    );
  });

  it('provides generic CRUD for the seeded project and task resources', async () => {
    const projectId = await createRecord('project', {
      name: 'Apollo',
      status: 'active',
    });
    const taskId = await createRecord('task', {
      title: 'Write the proposal',
      projectId,
      status: 'open',
    });

    const fetched = await api().get(`/api/v1/records/task/${taskId}`).set(asAdmin()).expect(200);
    expect(fetched.body.data.data).toMatchObject({
      title: 'Write the proposal',
      status: 'open',
    });
  });

  it('runs the custom complete action, persists the patch and emits the event', async () => {
    const taskId = await createRecord('task', { title: 'Ship the release', status: 'open' });

    const response = await api()
      .post(`/api/v1/records/task/${taskId}/actions/complete`)
      .set(asAdmin())
      .send({})
      .expect(200);

    expect(response.body.data.record).toMatchObject({
      resource: 'task',
      data: { title: 'Ship the release', status: 'done' },
    });
    expect(response.body.data.result).toEqual({ status: 'done' });

    // The consumer subscribed to `task.completed` ran synchronously in the same request
    // and wrote an operational event.
    const client = app.get(PrismaService).getClient();
    const event = await withTenantContext(client, companyId, (tx) =>
      tx.logEvent.findFirst({
        where: { companyId, eventType: 'task.completed', resourceId: taskId },
      }),
    );
    expect(event).not.toBeNull();
    expect(event?.resource).toBe('task');
    expect(event?.metadata).toMatchObject({ title: 'Ship the release' });
  });

  it('rejects completing a task twice with a conflict', async () => {
    const taskId = await createRecord('task', { title: 'Idempotent?', status: 'open' });
    await api()
      .post(`/api/v1/records/task/${taskId}/actions/complete`)
      .set(asAdmin())
      .send({})
      .expect(200);
    await api()
      .post(`/api/v1/records/task/${taskId}/actions/complete`)
      .set(asAdmin())
      .send({})
      .expect(409);
  });

  it('returns 404 for an action that is not registered', async () => {
    const taskId = await createRecord('task', { title: 'Unknown action', status: 'open' });
    await api()
      .post(`/api/v1/records/task/${taskId}/actions/frobnicate`)
      .set(asAdmin())
      .send({})
      .expect(404);
  });

  it('enforces permissions on registry-registered resources', async () => {
    await api().post('/api/v1/records/task').set(asNoAccess()).send({ title: 'Nope' }).expect(403);

    await api()
      .post('/api/v1/records/task/00000000-0000-0000-0000-000000000000/actions/complete')
      .set(asNoAccess())
      .send({})
      .expect(403);
  });

  it('validates the seeded required fields', async () => {
    await api().post('/api/v1/records/task').set(asAdmin()).send({}).expect(400);
  });
});
