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
 * End-to-end coverage for the generic CRUD runtime.
 *
 * A resource registered at runtime turns into working `records` endpoints without any
 * bespoke module: capability is checked against the caller's live permissions and the
 * grant's scope becomes a row-level predicate. The suite registers its own resource,
 * permissions and roles directly so it never depends on the seeded catalogue.
 */
describe('Generic CRUD runtime (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const resourceKey = `e2e_note_${suffix}`;
  const managerRoleKey = `E2E_CRUD_MANAGER_${suffix.toUpperCase()}`;
  const selfRoleKey = `E2E_CRUD_SELF_${suffix.toUpperCase()}`;
  const noAccessRoleKey = `E2E_CRUD_NONE_${suffix.toUpperCase()}`;

  const password = 'Str0ng-Passw0rd!';
  const managerEmail = `crud-manager-${suffix}@acme.test`;
  const selfEmail = `crud-self-${suffix}@acme.test`;
  const noneEmail = `crud-none-${suffix}@acme.test`;

  let companyId = '';
  let managerToken = '';
  let selfToken = '';
  let noneToken = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const provisioned = await provisionTenant(app, {
      adminEmail: `crud-admin-${suffix}@acme.test`,
      adminPassword: password,
    });
    companyId = provisioned.companyId;

    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const client = prisma.getClient();
    const hash = await passwords.hashPassword(password);

    await client.application.create({
      data: {
        key: `e2e-crud-app-${suffix}`,
        name: `E2E CRUD ${suffix}`,
        modules: {
          create: { key: `e2e-crud-module-${suffix}`, name: 'E2E CRUD Module' },
        },
        resources: {
          create: {
            key: resourceKey,
            name: 'E2E Note',
            resourceType: 'TRANSACTION',
            supportsCrud: true,
            fields: {
              create: [
                { key: 'title', label: 'Title', dataType: 'STRING', required: true },
                { key: 'priority', label: 'Priority', dataType: 'NUMBER' },
                { key: 'secret', label: 'Secret', dataType: 'STRING', isSensitive: true },
              ],
            },
          },
        },
      },
    });

    await client.permission.createMany({
      data: (['view', 'create', 'update', 'delete', 'view_sensitive'] as const).map((action) => ({
        key: `${resourceKey}.${action}`,
        resource: resourceKey,
        action,
      })),
    });

    const permissions = await client.permission.findMany({ where: { resource: resourceKey } });

    const managerPerms = permissions;
    const selfPerms = permissions.filter((p) => p.action !== 'view_sensitive');
    const managerRole = await client.role.create({
      data: {
        key: managerRoleKey,
        name: 'E2E CRUD Manager',
        description: 'Company-wide CRUD on the e2e resource',
        grants: {
          create: managerPerms.map((permission) => ({
            permissionId: permission.id,
            dataScope: 'COMPANY',
          })),
        },
      },
    });
    const selfRole = await client.role.create({
      data: {
        key: selfRoleKey,
        name: 'E2E CRUD Self',
        description: 'Self-scoped CRUD on the e2e resource',
        grants: {
          create: selfPerms.map((permission) => ({
            permissionId: permission.id,
            dataScope: 'SELF',
          })),
        },
      },
    });
    const noAccessRole = await client.role.create({
      data: {
        key: noAccessRoleKey,
        name: 'E2E CRUD None',
        description: 'No CRUD on the e2e resource',
      },
    });

    await withTenantContext(client, companyId, async (tx) => {
      const managerId = randomUUID();
      const selfId = randomUUID();
      const noneId = randomUUID();
      await tx.user.createMany({
        data: [
          {
            id: managerId,
            companyId,
            email: managerEmail,
            displayName: 'CRUD Manager',
            status: 'ACTIVE',
            passwordHash: hash,
            hasVerifiedEmail: true,
          },
          {
            id: selfId,
            companyId,
            email: selfEmail,
            displayName: 'CRUD Self',
            status: 'ACTIVE',
            passwordHash: hash,
            hasVerifiedEmail: true,
          },
          {
            id: noneId,
            companyId,
            email: noneEmail,
            displayName: 'CRUD None',
            status: 'ACTIVE',
            passwordHash: hash,
            hasVerifiedEmail: true,
          },
        ],
      });
      await tx.userRole.createMany({
        data: [
          { userId: managerId, roleId: managerRole.id, companyId },
          { userId: selfId, roleId: selfRole.id, companyId },
          { userId: noneId, roleId: noAccessRole.id, companyId },
        ],
      });
    });

    managerToken = await login(managerEmail);
    selfToken = await login(selfEmail);
    noneToken = await login(noneEmail);
  });

  afterAll(async () => {
    const client = app.get(PrismaService).getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.resourceRecord.deleteMany({ where: { companyId } });
    });
    await client.role.deleteMany({
      where: { key: { in: [managerRoleKey, selfRoleKey, noAccessRoleKey] } },
    });
    await client.permission.deleteMany({ where: { resource: resourceKey } });
    await client.application.deleteMany({ where: { key: `e2e-crud-app-${suffix}` } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asManager = () => ({ Authorization: `Bearer ${managerToken}` });
  const asSelf = () => ({ Authorization: `Bearer ${selfToken}` });
  const asNone = () => ({ Authorization: `Bearer ${noneToken}` });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.token as string;
  }

  async function createRecord(
    token: () => Record<string, string>,
    title = 'First note',
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await api()
      .post(`/api/v1/records/${resourceKey}`)
      .set(token())
      .send({ title, ...extra })
      .expect(201);
    return response.body.data.id as string;
  }

  it('creates a record from a runtime-registered resource', async () => {
    const response = await api()
      .post(`/api/v1/records/${resourceKey}`)
      .set(asManager())
      .send({ title: 'Hello', priority: 3 })
      .expect(201);

    expect(response.body.data).toMatchObject({
      resource: resourceKey,
      data: { title: 'Hello', priority: 3 },
      unitId: null,
    });
  });

  it('lists records within the caller scope', async () => {
    const response = await api().get(`/api/v1/records/${resourceKey}`).set(asManager()).expect(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('rejects a payload missing a required field', async () => {
    await api().post(`/api/v1/records/${resourceKey}`).set(asManager()).send({}).expect(400);
  });

  it('rejects a payload with an unknown field', async () => {
    await api()
      .post(`/api/v1/records/${resourceKey}`)
      .set(asManager())
      .send({ title: 'x', nope: true })
      .expect(400);
  });

  it('rejects a field with the wrong type', async () => {
    await api()
      .post(`/api/v1/records/${resourceKey}`)
      .set(asManager())
      .send({ title: 'Hello', priority: 'high' })
      .expect(400);
  });

  it('updates a record and merges the provided fields', async () => {
    const id = await createRecord(asManager, 'Original');
    const response = await api()
      .patch(`/api/v1/records/${resourceKey}/${id}`)
      .set(asManager())
      .send({ priority: 9 })
      .expect(200);

    expect(response.body.data.data).toMatchObject({ title: 'Original', priority: 9 });
  });

  it('deletes a record and hides it afterwards', async () => {
    const id = await createRecord(asManager, 'To remove');
    await api().delete(`/api/v1/records/${resourceKey}/${id}`).set(asManager()).expect(204);
    await api().get(`/api/v1/records/${resourceKey}/${id}`).set(asManager()).expect(404);
  });

  it('refuses a resource that does not support CRUD', async () => {
    await api().get('/api/v1/records/employee').set(asManager()).expect(404);
  });

  it('refuses a caller without a capability on the resource', async () => {
    await api()
      .post(`/api/v1/records/${resourceKey}`)
      .set(asNone())
      .send({ title: 'Nope' })
      .expect(403);
  });

  it('limits a SELF grant to the records the caller owns', async () => {
    const selfRecordId = await createRecord(asSelf, 'Self note');

    await api().get(`/api/v1/records/${resourceKey}/${selfRecordId}`).set(asSelf()).expect(200);

    await api().get(`/api/v1/records/${resourceKey}/${selfRecordId}`).set(asManager()).expect(200);

    const managerRecordId = await createRecord(asManager, 'Manager note');
    await api().get(`/api/v1/records/${resourceKey}/${managerRecordId}`).set(asSelf()).expect(404);

    const list = await api().get(`/api/v1/records/${resourceKey}`).set(asSelf()).expect(200);
    const ids = (list.body.data.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(selfRecordId);
    expect(ids).not.toContain(managerRecordId);
  });

  it('rejects an unknown field on update', async () => {
    const id = await createRecord(asManager, 'Validate me');
    await api()
      .patch(`/api/v1/records/${resourceKey}/${id}`)
      .set(asManager())
      .send({ nope: true })
      .expect(400);
  });

  it('masks sensitive fields for callers without view_sensitive', async () => {
    const id = await createRecord(asSelf, 'Secret note', { secret: 'super-secret' });
    const verify = await api()
      .get(`/api/v1/records/${resourceKey}/${id}`)
      .set(asManager())
      .expect(200);
    expect(verify.body.data.data.secret).toBe('super-secret');

    await api().get(`/api/v1/records/${resourceKey}/${id}`).set(asNone()).expect(403);

    const selfGet = await api()
      .get(`/api/v1/records/${resourceKey}/${id}`)
      .set(asSelf())
      .expect(200);
    expect(selfGet.body.data.data.secret).toBe('[REDACTED]');

    const managerGet = await api()
      .get(`/api/v1/records/${resourceKey}/${id}`)
      .set(asManager())
      .expect(200);
    expect(managerGet.body.data.data.secret).toBe('super-secret');

    const selfList = await api().get(`/api/v1/records/${resourceKey}`).set(asSelf()).expect(200);
    const selfItem = (
      selfList.body.data.items as { id: string; data: Record<string, unknown> }[]
    ).find((item) => item.id === id);
    expect((selfItem?.data as Record<string, unknown>).secret).toBe('[REDACTED]');

    const managerList = await api()
      .get(`/api/v1/records/${resourceKey}`)
      .set(asManager())
      .expect(200);
    const managerItem = (
      managerList.body.data.items as { id: string; data: Record<string, unknown> }[]
    ).find((item) => item.id === id);
    expect((managerItem?.data as Record<string, unknown>).secret).toBe('super-secret');
  });
});
