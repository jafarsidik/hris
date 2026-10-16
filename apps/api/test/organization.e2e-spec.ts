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
 * End-to-end coverage for the organizational structure: legal entities, the unit tree
 * beneath them, the validation that keeps that tree acyclic, and the placement of users
 * on it. The admin holds SYSTEM_ADMIN (GLOBAL scope), so these exercise the CRUD surface
 * and its integrity rules; the scope narrowing itself is covered by data-scope.e2e.
 */
describe('Organization structure (e2e)', () => {
  let app: INestApplication;

  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `org-admin-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let token = '';
  let companyId = '';
  let entityId = '';
  let divisionId = '';
  let departmentId = '';
  let teamId = '';
  let memberId = '';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    companyId = (await provisionTenant(app, { adminEmail, adminPassword: password })).companyId;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    token = login.body.data.token as string;
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${token}` });
  const entityPath = (id = '') => `/api/v1/organization/entities${id === '' ? '' : `/${id}`}`;
  const unitPath = (id = '') => `/api/v1/organization/units${id === '' ? '' : `/${id}`}`;

  it('requires authentication', async () => {
    await api().get(entityPath()).expect(401);
    await api().get(unitPath()).expect(401);
  });

  describe('legal entities', () => {
    it('creates a legal entity', async () => {
      const response = await api()
        .post(entityPath())
        .set(asAdmin())
        .send({
          code: `HQ-${suffix}`,
          name: 'Headquarters',
          countryCode: 'my',
          currencyCode: 'myr',
        })
        .expect(201);

      entityId = response.body.data.id as string;
      expect(response.body.data.code).toBe(`HQ-${suffix}`);
      expect(response.body.data.countryCode).toBe('MY');
      expect(response.body.data.currencyCode).toBe('MYR');
    });

    it('rejects a duplicate entity code', async () => {
      await api()
        .post(entityPath())
        .set(asAdmin())
        .send({ code: `HQ-${suffix}`, name: 'Duplicate', countryCode: 'MY', currencyCode: 'MYR' })
        .expect(409);
    });

    it('rejects an invalid country code length', async () => {
      await api()
        .post(entityPath())
        .set(asAdmin())
        .send({ code: `BAD-${suffix}`, name: 'Bad', countryCode: 'MYS', currencyCode: 'MYR' })
        .expect(400);
    });

    it('lists the entity', async () => {
      const response = await api().get(entityPath()).set(asAdmin()).expect(200);
      const items = response.body.data.items as { id: string }[];
      expect(items.some((item) => item.id === entityId)).toBe(true);
    });

    it('reads and updates the entity', async () => {
      await api().get(entityPath(entityId)).set(asAdmin()).expect(200);
      const response = await api()
        .patch(entityPath(entityId))
        .set(asAdmin())
        .send({ name: 'Head Office' })
        .expect(200);
      expect(response.body.data.name).toBe('Head Office');
    });
  });

  describe('organizational units', () => {
    it('creates a division, department and team', async () => {
      const division = await api()
        .post(unitPath())
        .set(asAdmin())
        .send({ code: `DIV-${suffix}`, name: 'Division', type: 'DIVISION', entityId })
        .expect(201);
      divisionId = division.body.data.id as string;
      expect(division.body.data.entityId).toBe(entityId);
      expect(division.body.data.parentId).toBeNull();

      const department = await api()
        .post(unitPath())
        .set(asAdmin())
        .send({
          code: `DEP-${suffix}`,
          name: 'Department',
          type: 'DEPARTMENT',
          entityId,
          parentId: divisionId,
        })
        .expect(201);
      departmentId = department.body.data.id as string;

      const team = await api()
        .post(unitPath())
        .set(asAdmin())
        .send({
          code: `TEAM-${suffix}`,
          name: 'Team',
          type: 'TEAM',
          entityId,
          parentId: departmentId,
        })
        .expect(201);
      teamId = team.body.data.id as string;
    });

    it('rejects a duplicate unit code', async () => {
      await api()
        .post(unitPath())
        .set(asAdmin())
        .send({ code: `DIV-${suffix}`, name: 'Duplicate', type: 'DIVISION', entityId })
        .expect(409);
    });

    it('rejects an unknown parent', async () => {
      const response = await api()
        .post(unitPath())
        .set(asAdmin())
        .send({
          code: `ORPHAN-${suffix}`,
          name: 'Orphan',
          type: 'TEAM',
          entityId,
          parentId: randomUUID(),
        })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('lists units filtered by parent', async () => {
      const response = await api()
        .get(`${unitPath()}?parentId=${divisionId}`)
        .set(asAdmin())
        .expect(200);
      const ids = (response.body.data.items as { id: string }[]).map((item) => item.id);
      expect(ids).toContain(departmentId);
      expect(ids).not.toContain(teamId);
    });

    it('refuses to move a unit beneath its own descendant', async () => {
      const response = await api()
        .patch(unitPath(divisionId))
        .set(asAdmin())
        .send({ parentId: teamId })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuses to delete a unit that still has children', async () => {
      await api().delete(unitPath(divisionId)).set(asAdmin()).expect(409);
    });

    it('refuses to delete an entity that still has units', async () => {
      await api().delete(entityPath(entityId)).set(asAdmin()).expect(409);
    });

    it('deletes a leaf unit', async () => {
      await api().delete(unitPath(teamId)).set(asAdmin()).expect(204);
      const response = await api().get(unitPath(teamId)).set(asAdmin()).expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for an unknown unit', async () => {
      await api().get(unitPath(randomUUID())).set(asAdmin()).expect(404);
    });
  });

  describe('user placement', () => {
    const memberEmail = `org-member-${suffix}@acme.test`;

    it('creates a user placed on a unit', async () => {
      const response = await api()
        .post('/api/v1/users')
        .set(asAdmin())
        .send({
          email: memberEmail,
          displayName: 'Placed Member',
          password,
          roleIds: [],
          organizationalUnitId: departmentId,
        })
        .expect(200);

      memberId = response.body.data.id as string;
      expect(response.body.data.organizationalUnitId).toBe(departmentId);
      expect(response.body.data.organizationalUnit).toMatchObject({
        id: departmentId,
        name: 'Department',
        type: 'DEPARTMENT',
      });
    });

    it('filters users by their organizational unit', async () => {
      const response = await api()
        .get(`/api/v1/users?organizationalUnitId=${departmentId}`)
        .set(asAdmin())
        .expect(200);
      const emails = (response.body.data.items as { email: string }[]).map((item) => item.email);
      expect(emails).toContain(memberEmail);
    });

    it('rejects placement on an unknown unit', async () => {
      const response = await api()
        .post('/api/v1/users')
        .set(asAdmin())
        .send({
          email: `org-bad-${suffix}@acme.test`,
          displayName: 'Bad Placement',
          password,
          roleIds: [],
          organizationalUnitId: randomUUID(),
        })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('moves the user to another unit', async () => {
      const response = await api()
        .patch(`/api/v1/users/${memberId}`)
        .set(asAdmin())
        .send({ organizationalUnitId: divisionId })
        .expect(200);
      expect(response.body.data.organizationalUnitId).toBe(divisionId);
    });

    it('clears the user’s unit', async () => {
      const response = await api()
        .patch(`/api/v1/users/${memberId}`)
        .set(asAdmin())
        .send({ organizationalUnitId: null })
        .expect(200);
      expect(response.body.data.organizationalUnitId).toBeNull();
      expect(response.body.data.organizationalUnit).toBeNull();
    });
  });

  describe('placement scope', () => {
    const scopedEmail = `org-scoped-${suffix}@acme.test`;
    const scopedRoleKey = `USER_PLACE_DEPT_${suffix.toUpperCase()}`;
    let scopedToken = '';

    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      const passwords = app.get(PasswordService);
      const client = prisma.getClient();
      const hash = await passwords.hashPassword(password);

      await withTenantContext(client, companyId, async (tx) => {
        const scoped = await tx.user.create({
          data: {
            companyId,
            email: scopedEmail,
            displayName: 'Department manager',
            status: 'ACTIVE',
            passwordHash: hash,
            hasVerifiedEmail: true,
            organizationalUnitId: departmentId,
          },
        });
        const role = await tx.role.create({
          data: {
            key: scopedRoleKey,
            name: 'Department user manager',
            description: '',
            isSystem: false,
          },
        });
        const update = await tx.permission.findUniqueOrThrow({ where: { key: 'user.update' } });
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: update.id, dataScope: 'DEPARTMENT' },
        });
        await tx.userRole.create({ data: { userId: scoped.id, roleId: role.id, companyId } });
      });

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: scopedEmail, password })
        .expect(200);
      scopedToken = login.body.data.token as string;
    });

    afterAll(async () => {
      await app
        .get(PrismaService)
        .getClient()
        .role.deleteMany({ where: { key: scopedRoleKey } });
    });

    it('refuses to place a user outside the caller’s department subtree', async () => {
      const response = await api()
        .patch(`/api/v1/users/${memberId}`)
        .set({ Authorization: `Bearer ${scopedToken}` })
        .send({ organizationalUnitId: divisionId })
        .expect(403);
      expect(response.body.error.code).toBe('OUT_OF_SCOPE');
    });

    it('allows placement inside the caller’s department subtree', async () => {
      const response = await api()
        .patch(`/api/v1/users/${memberId}`)
        .set({ Authorization: `Bearer ${scopedToken}` })
        .send({ organizationalUnitId: departmentId })
        .expect(200);
      expect(response.body.data.organizationalUnitId).toBe(departmentId);
    });
  });
});
