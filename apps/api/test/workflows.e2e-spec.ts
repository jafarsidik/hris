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

const MACHINE = {
  states: [
    { key: 'draft', name: 'Draft', isInitial: true, isFinal: false },
    { key: 'in_review', name: 'In review', isInitial: false, isFinal: false },
    { key: 'approved', name: 'Approved', isInitial: false, isFinal: true },
    { key: 'rejected', name: 'Rejected', isInitial: false, isFinal: true },
  ],
  transitions: [
    { name: 'submit', fromStateKey: 'draft', toStateKey: 'in_review' },
    {
      name: 'approve',
      fromStateKey: 'in_review',
      toStateKey: 'approved',
      requiredPermission: 'workflow.approve',
      requiresApproval: true,
    },
    {
      name: 'reject',
      fromStateKey: 'in_review',
      toStateKey: 'rejected',
      requiredPermission: 'workflow.reject',
    },
  ],
};

/**
 * End-to-end coverage of the workflow engine: authoring a definition, publishing an
 * immutable version, and running instances whose transitions are gated by live
 * permissions and the approval-authority rules.
 */
describe('Workflow engine (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `workflow-admin-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let companyId = '';
  let adminId = '';
  let adminToken = '';

  let definitionId = '';
  let instanceId = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const provisioned = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = provisioned.companyId;
    adminId = provisioned.adminId;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminToken = login.body.data.token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  it('creates a definition with a draft version', async () => {
    const response = await api()
      .post('/api/v1/workflows')
      .set(asAdmin())
      .send({ key: `leave_${suffix}`, name: 'Leave approval', description: 'Two-step approval' })
      .expect(201);

    definitionId = response.body.data.id as string;
    expect(response.body.data.key).toBe(`leave_${suffix}`);
    expect(response.body.data.activeVersion).toBeNull();
    expect(response.body.data.draftVersion).toBe(1);
  });

  it('rejects a duplicate key', async () => {
    await api()
      .post('/api/v1/workflows')
      .set(asAdmin())
      .send({ key: `leave_${suffix}`, name: 'Leave approval' })
      .expect(409);
  });

  it('saves and publishes a valid version', async () => {
    const saved = await api()
      .put(`/api/v1/workflows/${definitionId}/versions/1`)
      .set(asAdmin())
      .send(MACHINE)
      .expect(200);
    expect((saved.body.data.states as unknown[]).length).toBe(4);

    const published = await api()
      .post(`/api/v1/workflows/${definitionId}/versions/1/publish`)
      .set(asAdmin())
      .expect(200);
    expect(published.body.data.status).toBe('ACTIVE');

    const detail = await api().get(`/api/v1/workflows/${definitionId}`).set(asAdmin()).expect(200);
    expect(detail.body.data.definition.activeVersion).toBe(1);
  });

  it('rejects an invalid state machine on save', async () => {
    const created = await api()
      .post('/api/v1/workflows')
      .set(asAdmin())
      .send({ key: `invalid_${suffix}`, name: 'Invalid machine' })
      .expect(201);

    await api()
      .put(`/api/v1/workflows/${created.body.data.id}/versions/1`)
      .set(asAdmin())
      .send({
        states: [
          { key: 'a', name: 'A', isInitial: true },
          { key: 'b', name: 'B', isInitial: true },
        ],
        transitions: [],
      })
      .expect(400);
  });

  it('starts an instance at the initial state', async () => {
    const response = await api()
      .post('/api/v1/workflow-instances')
      .set(asAdmin())
      .send({ definitionId, resource: 'leave-request', resourceId: randomUUID() })
      .expect(201);

    instanceId = response.body.data.id as string;
    expect(response.body.data.currentStateKey).toBe('draft');
    expect(response.body.data.status).toBe('IN_PROGRESS');
    expect(response.body.data.version).toBe(1);
  });

  it('executes an allowed transition and records history', async () => {
    const response = await api()
      .post(`/api/v1/workflow-instances/${instanceId}/transitions`)
      .set(asAdmin())
      .send({ transition: 'submit', comment: 'Please review' })
      .expect(200);

    expect(response.body.data.currentStateKey).toBe('in_review');
    expect(response.body.data.status).toBe('IN_PROGRESS');

    const detail = await api()
      .get(`/api/v1/workflow-instances/${instanceId}`)
      .set(asAdmin())
      .expect(200);
    const history = detail.body.data.history as { transitionName: string }[];
    expect(history.map((event) => event.transitionName)).toEqual(['START', 'submit']);
  });

  it('requires an approval authority when the transition demands it', async () => {
    await api()
      .post(`/api/v1/workflow-instances/${instanceId}/transitions`)
      .set(asAdmin())
      .send({ transition: 'approve' })
      .expect(403);

    const client = app.get(PrismaService).getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.create({
        data: { companyId, subjectType: 'USER', subjectId: adminId, createdBy: adminId },
      }),
    );

    const response = await api()
      .post(`/api/v1/workflow-instances/${instanceId}/transitions`)
      .set(asAdmin())
      .send({ transition: 'approve' })
      .expect(200);

    expect(response.body.data.currentStateKey).toBe('approved');
    expect(response.body.data.status).toBe('COMPLETED');
  });

  it('rejects a transition from a completed instance', async () => {
    await api()
      .post(`/api/v1/workflow-instances/${instanceId}/transitions`)
      .set(asAdmin())
      .send({ transition: 'reject' })
      .expect(409);
  });

  it('enforces the transition permission for a limited API client', async () => {
    const created = await api()
      .post('/api/v1/developers/clients')
      .set(asAdmin())
      .send({ name: 'Workflow reader', scopes: ['workflow.view'] })
      .expect(201);
    const key = created.body.data.secret as string;

    await api()
      .post('/api/v1/workflow-instances')
      .set({ Authorization: `Bearer ${key}` })
      .send({ definitionId })
      .expect(403);

    await api()
      .get(`/api/v1/workflow-instances/${instanceId}`)
      .set({ Authorization: `Bearer ${key}` })
      .expect(200);
  });

  it('cancels an instance and refuses to cancel it twice', async () => {
    const started = await api()
      .post('/api/v1/workflow-instances')
      .set(asAdmin())
      .send({ definitionId })
      .expect(201);
    const id = started.body.data.id as string;

    const cancelled = await api()
      .post(`/api/v1/workflow-instances/${id}/cancel`)
      .set(asAdmin())
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    await api().post(`/api/v1/workflow-instances/${id}/cancel`).set(asAdmin()).expect(409);
  });

  it('does not expose definitions or instances to another tenant', async () => {
    const otherEmail = `workflow-other-${randomUUID().slice(0, 8)}@acme.test`;
    await provisionTenant(app, { adminEmail: otherEmail, adminPassword: password });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);
    const otherToken = otherLogin.body.data.token as string;

    await api()
      .get(`/api/v1/workflows/${definitionId}`)
      .set({ Authorization: `Bearer ${otherToken}` })
      .expect(404);
    await api()
      .get(`/api/v1/workflow-instances/${instanceId}`)
      .set({ Authorization: `Bearer ${otherToken}` })
      .expect(404);
  });
});
