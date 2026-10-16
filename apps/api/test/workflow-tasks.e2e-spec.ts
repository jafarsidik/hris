import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/auth/password.service';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { provisionTenant } from './helpers/iam-fixtures';

/** A task as served by `GET /workflow-tasks`, narrowed to what these tests assert. */
interface TaskRow {
  readonly id: string;
  readonly stepKey: string;
  readonly status: string;
  readonly assigneeUserId: string | null;
}

interface InstanceRow {
  readonly stepKey: string | null;
  readonly currentStateKey: string;
  readonly status: string;
}

/** Two approvers both hold `SYSTEM_ADMIN`, so a step routes to both of them. */
const STEP_DECISION = {
  requiredPermission: 'workflow.approve',
  requiresApproval: true,
} as const;

const SEQUENTIAL = {
  states: [
    { key: 'draft', name: 'Draft', isInitial: true, isFinal: false },
    { key: 'in_review', name: 'In review', isInitial: false, isFinal: false },
    { key: 'approved', name: 'Approved', isInitial: false, isFinal: true },
  ],
  transitions: [],
  steps: [
    {
      key: 'manager',
      name: 'Manager',
      type: 'SEQUENTIAL',
      decisionType: 'ALL_PREDECESSORS',
      ...STEP_DECISION,
      predecessorKeys: [],
      nextKeys: ['hr'],
      stateKey: 'in_review',
      timeoutMinutes: 120,
    },
    {
      key: 'hr',
      name: 'HR',
      type: 'SEQUENTIAL',
      decisionType: 'ALL_PREDECESSORS',
      ...STEP_DECISION,
      predecessorKeys: ['manager'],
      nextKeys: [],
      stateKey: 'approved',
      timeoutMinutes: 120,
    },
  ],
};

function singleStep(decisionType: 'ANY_PREDECESSOR' | 'ALL_PREDECESSORS') {
  return {
    states: [
      { key: 'draft', name: 'Draft', isInitial: true, isFinal: false },
      { key: 'pending', name: 'Pending', isInitial: false, isFinal: false },
      { key: 'approved', name: 'Approved', isInitial: false, isFinal: true },
      { key: 'rejected', name: 'Rejected', isInitial: false, isFinal: true },
    ],
    transitions: [],
    steps: [
      {
        key: 'approve',
        name: 'Approve',
        type: 'PARALLEL',
        decisionType,
        ...STEP_DECISION,
        predecessorKeys: [],
        nextKeys: [],
        stateKey: 'approved',
      },
    ],
  };
}

/** Returns the first element matching `predicate`, or throws a readable failure. */
function mustFind<T>(items: readonly T[], predicate: (item: T) => boolean): T {
  const found = items.find(predicate);
  if (found === undefined) {
    throw new Error('Expected a matching element, found none.');
  }
  return found;
}

/** Returns the element at `index`, or throws instead of yielding `undefined`. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`Expected at least ${index + 1} elements, found ${items.length}.`);
  }
  return value;
}

describe('Workflow tasks (step-driven routing)', () => {
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `wf-admin-${suffix}@acme.test`;
  const approverEmail = `wf-approver-${suffix}@acme.test`;
  const outsiderEmail = `wf-outsider-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let app: INestApplication;
  let companyId: string;
  let adminId: string;
  let adminToken: string;
  let approverId: string;
  let approverToken: string;
  /** A signed-in user with no roles, so no `workflow:*` permission. */
  let outsiderToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = tenant.companyId;
    adminId = tenant.adminId;

    const prisma = app.get(PrismaService);
    const client = prisma.getClient();
    const passwordHash = await app.get(PasswordService).hashPassword(password);
    approverId = randomUUID();

    await withTenantContext(client, companyId, async (tx) => {
      const adminRole = await tx.role.findUniqueOrThrow({ where: { key: 'SYSTEM_ADMIN' } });
      await tx.user.create({
        data: {
          id: approverId,
          companyId,
          email: approverEmail,
          displayName: 'E2E Approver',
          status: 'ACTIVE',
          passwordHash,
          hasVerifiedEmail: true,
        },
      });
      await tx.userRole.create({ data: { userId: approverId, roleId: adminRole.id, companyId } });
      // A user deliberately left without a role: used to prove the inbox route is gated.
      await tx.user.create({
        data: {
          id: randomUUID(),
          companyId,
          email: outsiderEmail,
          displayName: 'E2E Outsider',
          status: 'ACTIVE',
          passwordHash,
          hasVerifiedEmail: true,
        },
      });
      // A step that demands approval also demands approval authority; grant it to
      // both approvers so their decisions are accepted.
      await tx.approvalAuthority.create({
        data: { companyId, subjectType: 'USER', subjectId: adminId, createdBy: adminId },
      });
      await tx.approvalAuthority.create({
        data: { companyId, subjectType: 'USER', subjectId: approverId, createdBy: adminId },
      });
    });

    adminToken = await login(adminEmail);
    approverToken = await login(approverEmail);
    outsiderToken = await login(outsiderEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.token as string;
  }

  async function publishWorkflow(key: string, version: object): Promise<string> {
    const created = await api()
      .post('/api/v1/workflows')
      .set(asAdmin())
      .send({ key, name: key })
      .expect(201);
    const id = created.body.data.id as string;
    await request(app.getHttpServer())
      .put(`/api/v1/workflows/${id}/versions/1`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send(version)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${id}/versions/1/publish`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    return id;
  }

  async function startInstance(definitionId: string): Promise<string> {
    const started = await request(app.getHttpServer())
      .post('/api/v1/workflow-instances')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ definitionId })
      .expect(201);
    return started.body.data.id as string;
  }

  async function instanceOf(instanceId: string): Promise<InstanceRow> {
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/workflow-instances/${instanceId}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    return detail.body.data.instance as InstanceRow;
  }

  async function tasksOf(instanceId: string): Promise<TaskRow[]> {
    const listed = await request(app.getHttpServer())
      .get(`/api/v1/workflow-tasks?instanceId=${instanceId}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    return listed.body.data as TaskRow[];
  }

  async function decide(taskId: string, decision: string, token: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/workflow-tasks/${taskId}/decisions`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ decision })
      .expect(200);
  }

  it('routes a sequential graph and advances as each step settles', async () => {
    const definitionId = await publishWorkflow(`seq_${suffix}`, SEQUENTIAL);
    const instanceId = await startInstance(definitionId);

    const initial = await instanceOf(instanceId);
    expect(initial.stepKey).toBe('manager');
    expect(initial.currentStateKey).toBe('in_review');
    expect(initial.status).toBe('IN_PROGRESS');

    const managerTasks = await tasksOf(instanceId);
    expect(managerTasks.length).toBe(2);
    expect(managerTasks.every((task) => task.status === 'PENDING')).toBe(true);

    // Approve every manager task; the step is ALL_PREDECESSORS, so it needs both.
    for (const task of managerTasks) {
      await decide(task.id, 'APPROVE', adminToken);
    }

    const atHr = await instanceOf(instanceId);
    expect(atHr.stepKey).toBe('hr');
    expect(atHr.status).toBe('IN_PROGRESS');

    const hrTasks = (await tasksOf(instanceId)).filter(
      (task) => task.stepKey === 'hr' && task.status === 'PENDING',
    );
    expect(hrTasks.length).toBe(2);
    for (const task of hrTasks) {
      await decide(task.id, 'APPROVE', adminToken);
    }

    const completed = await instanceOf(instanceId);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.currentStateKey).toBe('approved');
  });

  it('advances on the first approval when the step is ANY_PREDECESSOR', async () => {
    const definitionId = await publishWorkflow(`any_${suffix}`, singleStep('ANY_PREDECESSOR'));
    const instanceId = await startInstance(definitionId);

    const tasks = await tasksOf(instanceId);
    expect(tasks.length).toBe(2);

    const approverTask = mustFind(tasks, (task) => task.assigneeUserId === approverId);
    await decide(approverTask.id, 'APPROVE', approverToken);

    const settled = await instanceOf(instanceId);
    expect(settled.status).toBe('COMPLETED');

    const after = await tasksOf(instanceId);
    expect(after.some((task) => task.status === 'SKIPPED')).toBe(true);
  });

  it('waits for every approval when the step is ALL_PREDECESSORS', async () => {
    const definitionId = await publishWorkflow(`all_${suffix}`, singleStep('ALL_PREDECESSORS'));
    const instanceId = await startInstance(definitionId);

    const tasks = await tasksOf(instanceId);
    expect(tasks.length).toBe(2);

    await decide(at(tasks, 0).id, 'APPROVE', adminToken);
    const halfway = await instanceOf(instanceId);
    expect(halfway.status).toBe('IN_PROGRESS');
    expect(halfway.stepKey).toBe('approve');

    await decide(at(tasks, 1).id, 'APPROVE', adminToken);
    const settled = await instanceOf(instanceId);
    expect(settled.status).toBe('COMPLETED');
  });

  it('rejects the instance when any approver rejects', async () => {
    const definitionId = await publishWorkflow(`reject_${suffix}`, singleStep('ALL_PREDECESSORS'));
    const instanceId = await startInstance(definitionId);

    const tasks = await tasksOf(instanceId);
    expect(tasks.length).toBe(2);
    await decide(at(tasks, 0).id, 'REJECT', adminToken);

    const settled = await instanceOf(instanceId);
    expect(settled.status).toBe('REJECTED');
  });

  it('lists only the caller’s own inbox through `workflow-tasks/mine`', async () => {
    const definitionId = await publishWorkflow(`mine_${suffix}`, singleStep('ANY_PREDECESSOR'));
    const instanceId = await startInstance(definitionId);

    // The engine materializes one task per candidate, so each approver owns a task.
    const all = await tasksOf(instanceId);
    expect(all.length).toBe(2);
    const adminTask = mustFind(all, (task) => task.assigneeUserId === adminId);
    const approverTask = mustFind(all, (task) => task.assigneeUserId === approverId);

    const adminInbox = await api().get('/api/v1/workflow-tasks/mine').set(asAdmin()).expect(200);
    const adminIds = (adminInbox.body.data as TaskRow[]).map((task) => task.id);
    expect(adminIds).toContain(adminTask.id);
    expect(adminIds).not.toContain(approverTask.id);

    const approverInbox = await api()
      .get('/api/v1/workflow-tasks/mine')
      .set({ Authorization: `Bearer ${approverToken}` })
      .expect(200);
    const approverIds = (approverInbox.body.data as TaskRow[]).map((task) => task.id);
    expect(approverIds).toContain(approverTask.id);
    expect(approverIds).not.toContain(adminTask.id);

    // A status filter narrows the inbox without widening it.
    const pending = await api()
      .get('/api/v1/workflow-tasks/mine?status=PENDING')
      .set({ Authorization: `Bearer ${approverToken}` })
      .expect(200);
    const pendingRows = pending.body.data as TaskRow[];
    expect(pendingRows.every((task) => task.status === 'PENDING')).toBe(true);
    expect(pendingRows.every((task) => task.assigneeUserId === approverId)).toBe(true);
  });

  it('refuses the inbox without `workflow:approve`', async () => {
    await api()
      .get('/api/v1/workflow-tasks/mine')
      .set({ Authorization: `Bearer ${outsiderToken}` })
      .expect(403);
  });
});
