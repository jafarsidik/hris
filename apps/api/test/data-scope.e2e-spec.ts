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
 * End-to-end coverage for record-level data scope on `user.view`.
 *
 * A grant's `dataScope` must constrain *which rows* the caller can reach, not merely
 * whether they hold the capability. `SELF` narrows to the caller, `COMPANY` covers the
 * tenant, `TEAM`/`DEPARTMENT` narrow to the organizational subtree rooted at the
 * caller's unit, and `ENTITY` narrows to the caller's legal entity. Placement in the
 * hierarchy is what makes the org scopes resolvable; without it they default-deny.
 */
describe('Record-level data scope (e2e)', () => {
  let app: INestApplication;

  const password = 'Str0ng-Passw0rd!';
  const suffix = randomUUID().slice(0, 8);

  const adminEmail = `scope-admin-${suffix}@acme.test`;
  const otherTenantEmail = `scope-other-${suffix}@acme.test`;
  const selfEmail = `scope-self-${suffix}@acme.test`;
  const companyEmail = `scope-company-${suffix}@acme.test`;
  const deptEmail = `scope-dept-${suffix}@acme.test`;
  const teamEmail = `scope-team-${suffix}@acme.test`;
  const entityEmail = `scope-entity-${suffix}@acme.test`;
  const memberTeamEmail = `scope-member-team-${suffix}@acme.test`;
  const memberDeptEmail = `scope-member-dept-${suffix}@acme.test`;
  const memberSiblingEmail = `scope-member-sibling-${suffix}@acme.test`;
  const memberOtherEntityEmail = `scope-member-other-entity-${suffix}@acme.test`;

  const roleKeys = {
    self: `SELF_VIEWER_${suffix.toUpperCase()}`,
    company: `COMPANY_VIEWER_${suffix.toUpperCase()}`,
    team: `TEAM_VIEWER_${suffix.toUpperCase()}`,
    dept: `DEPT_VIEWER_${suffix.toUpperCase()}`,
    entity: `ENTITY_VIEWER_${suffix.toUpperCase()}`,
  };

  let companyId: string;
  let adminId: string;
  let otherTenantId: string;
  let memberDeptId = '';
  let memberSiblingId = '';

  const tokens = {} as Record<'self' | 'company' | 'dept' | 'team' | 'entity' | 'admin', string>;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, moduleFixture.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = tenant.companyId;
    adminId = tenant.adminId;

    const otherTenant = await provisionTenant(app, {
      adminEmail: otherTenantEmail,
      adminPassword: password,
    });
    otherTenantId = otherTenant.adminId;

    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const client = prisma.getClient();
    const passwordHash = await passwords.hashPassword(password);

    await withTenantContext(client, companyId, async (tx) => {
      const view = await tx.permission.findUniqueOrThrow({ where: { key: 'user.view' } });

      const roleIds: Record<keyof typeof roleKeys, string> = {} as never;
      for (const [name, key] of Object.entries(roleKeys)) {
        const role = await tx.role.create({
          data: { key, name: `Scope ${name}`, description: '', isSystem: false },
        });
        roleIds[name as keyof typeof roleKeys] = role.id;
      }
      const scopeOf: Record<keyof typeof roleKeys, string> = {
        self: 'SELF',
        company: 'COMPANY',
        team: 'TEAM',
        dept: 'DEPARTMENT',
        entity: 'ENTITY',
      };
      for (const name of Object.keys(roleKeys) as (keyof typeof roleKeys)[]) {
        await tx.rolePermission.create({
          data: {
            roleId: roleIds[name],
            permissionId: view.id,
            dataScope: scopeOf[name] as 'SELF',
          },
        });
      }

      const entityHq = await tx.entity.create({
        data: {
          companyId,
          code: 'HQ',
          name: 'Headquarters',
          countryCode: 'MY',
          currencyCode: 'MYR',
        },
      });
      const entityRemote = await tx.entity.create({
        data: {
          companyId,
          code: 'REMOTE',
          name: 'Remote',
          countryCode: 'MY',
          currencyCode: 'MYR',
        },
      });

      const division = await tx.organizationalUnit.create({
        data: { companyId, entityId: entityHq.id, type: 'DIVISION', code: 'DIV', name: 'Division' },
      });
      const department = await tx.organizationalUnit.create({
        data: {
          companyId,
          entityId: entityHq.id,
          parentId: division.id,
          type: 'DEPARTMENT',
          code: 'DEP1',
          name: 'Department One',
        },
      });
      const team = await tx.organizationalUnit.create({
        data: {
          companyId,
          entityId: entityHq.id,
          parentId: department.id,
          type: 'TEAM',
          code: 'TEAM1',
          name: 'Team One',
        },
      });
      const siblingDepartment = await tx.organizationalUnit.create({
        data: {
          companyId,
          entityId: entityHq.id,
          parentId: division.id,
          type: 'DEPARTMENT',
          code: 'DEP2',
          name: 'Department Two',
        },
      });
      const remoteDepartment = await tx.organizationalUnit.create({
        data: {
          companyId,
          entityId: entityRemote.id,
          type: 'DEPARTMENT',
          code: 'DEP3',
          name: 'Remote Department',
        },
      });

      const members: {
        email: string;
        roleId: string | null;
        unitId: string | null;
      }[] = [
        { email: selfEmail, roleId: roleIds.self, unitId: null },
        { email: companyEmail, roleId: roleIds.company, unitId: null },
        { email: deptEmail, roleId: roleIds.dept, unitId: department.id },
        { email: teamEmail, roleId: roleIds.team, unitId: team.id },
        { email: entityEmail, roleId: roleIds.entity, unitId: department.id },
        { email: memberTeamEmail, roleId: null, unitId: team.id },
        { email: memberDeptEmail, roleId: null, unitId: department.id },
        { email: memberSiblingEmail, roleId: null, unitId: siblingDepartment.id },
        { email: memberOtherEntityEmail, roleId: null, unitId: remoteDepartment.id },
      ];

      for (const member of members) {
        const created = await tx.user.create({
          data: {
            companyId,
            email: member.email,
            displayName: 'Scoped User',
            status: 'ACTIVE',
            passwordHash,
            hasVerifiedEmail: true,
            organizationalUnitId: member.unitId,
          },
        });
        if (member.roleId) {
          await tx.userRole.create({
            data: { userId: created.id, roleId: member.roleId, companyId },
          });
        }
        if (member.email === memberDeptEmail) {
          memberDeptId = created.id;
        }
        if (member.email === memberSiblingEmail) {
          memberSiblingId = created.id;
        }
      }
    });

    const login = async (email: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return response.body.data.token as string;
    };

    tokens.self = await login(selfEmail);
    tokens.company = await login(companyEmail);
    tokens.dept = await login(deptEmail);
    tokens.team = await login(teamEmail);
    tokens.entity = await login(entityEmail);
    tokens.admin = await login(adminEmail);
  });

  afterAll(async () => {
    // Roles are platform-wide (no company column), so a run's roles would otherwise
    // leak into the shared database and skew global role counts. Deleting them cascades
    // to their grants and memberships.
    await app
      .get(PrismaService)
      .getClient()
      .role.deleteMany({ where: { key: { in: Object.values(roleKeys) } } });
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const emailsOf = async (token: string): Promise<string[]> => {
    const response = await api().get('/api/v1/users').set(bearer(token)).expect(200);
    return (response.body.data.items as { email: string }[]).map((item) => item.email);
  };

  it('lists only the caller when their scope is SELF', async () => {
    expect(await emailsOf(tokens.self)).toEqual([selfEmail]);
  });

  it('returns the caller their own record under SELF scope', async () => {
    const me = await api().get('/api/v1/users').set(bearer(tokens.self)).expect(200);
    const id = (me.body.data.items as { id: string }[])[0]?.id;
    await api().get(`/api/v1/users/${id}`).set(bearer(tokens.self)).expect(200);
  });

  it('rejects reading another user under SELF scope with OUT_OF_SCOPE', async () => {
    const response = await api()
      .get(`/api/v1/users/${adminId}`)
      .set(bearer(tokens.self))
      .expect(403);
    expect(response.body.error.code).toBe('OUT_OF_SCOPE');
  });

  it('lists the whole tenant when their scope is COMPANY', async () => {
    const emails = await emailsOf(tokens.company);
    expect(emails).toContain(adminEmail);
    expect(emails).toContain(memberOtherEntityEmail);
  });

  it('cannot reach another tenant even with COMPANY scope', async () => {
    await api().get(`/api/v1/users/${otherTenantId}`).set(bearer(tokens.company)).expect(404);
  });

  it('narrows DEPARTMENT scope to the subtree rooted at the caller’s unit', async () => {
    const emails = await emailsOf(tokens.dept);
    expect(emails).toContain(deptEmail);
    expect(emails).toContain(memberDeptEmail);
    expect(emails).toContain(memberTeamEmail);
    expect(emails).not.toContain(memberSiblingEmail);
    expect(emails).not.toContain(memberOtherEntityEmail);
  });

  it('refuses to read a user outside the caller’s DEPARTMENT subtree', async () => {
    await api().get(`/api/v1/users/${memberSiblingId}`).set(bearer(tokens.dept)).expect(404);
  });

  it('narrows TEAM scope to the caller’s team only', async () => {
    const emails = await emailsOf(tokens.team);
    expect(emails).toContain(memberTeamEmail);
    expect(emails).not.toContain(memberDeptEmail);
    expect(emails).not.toContain(memberSiblingEmail);
  });

  it('narrows ENTITY scope to the caller’s legal entity', async () => {
    const emails = await emailsOf(tokens.entity);
    expect(emails).toContain(memberDeptEmail);
    expect(emails).toContain(memberSiblingEmail);
    expect(emails).not.toContain(memberOtherEntityEmail);
  });

  it('leaves GLOBAL scope (SYSTEM_ADMIN) unrestricted', async () => {
    const response = await api().get('/api/v1/users').set(bearer(tokens.admin)).expect(200);
    expect((response.body.data.items as unknown[]).length).toBeGreaterThanOrEqual(3);
  });

  it('lets a DEPARTMENT caller read a user inside the subtree', async () => {
    await api().get(`/api/v1/users/${memberDeptId}`).set(bearer(tokens.dept)).expect(200);
  });
});
