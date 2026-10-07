/**
 * Proves row-level security actually enforces tenant isolation.
 *
 * These are integration tests rather than unit tests because the behaviour under test is
 * PostgreSQL's, not TypeScript's. A mocked Prisma client would return whatever the test
 * told it to return, and would therefore pass in exactly the situation where the policies
 * are broken. The connection also has to be the application role: the owner role is a
 * superuser and bypasses RLS unconditionally, so a suite that accidentally connects as
 * the owner reports every policy as working.
 */
import { config as loadEnvFile } from 'dotenv';
import { join } from 'node:path';

import { ACTIONS, COUNTRY_CODES, RESOURCES, SYSTEM_ROLE_KEYS } from '@hris/shared-types';

import { Pool } from 'pg';

import {
  createPrismaClient,
  withCompanyProvisioning,
  withTenantContext,
  type DatabaseClient,
} from '../src/index';

loadEnvFile({ path: join(__dirname, '..', '..', '.env'), quiet: true });

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';

describe('tenant isolation (integration)', () => {
  let client: DatabaseClient;
  let owner: Pool;

  beforeAll(async () => {
    client = createPrismaClient();
    // The owner role is used only for cleanup, because audit rows are append-only and
    // cannot be deleted by the application role at all.
    owner = new Pool({
      connectionString: `postgresql://${process.env['POSTGRES_USER'] ?? 'hris'}:${process.env['POSTGRES_PASSWORD']}@localhost:5435/hris`,
      max: 1,
    });
  });

  afterAll(async () => {
    await client.$disconnect();
    await owner.end();
  });

  beforeEach(async () => {
    await owner.query('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_or_delete');
    await owner.query('DELETE FROM audit_logs');
    await owner.query('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_or_delete');
    await owner.query('DELETE FROM users');
    await owner.query('DELETE FROM companies');

    await withCompanyProvisioning(client, COMPANY_A, (tx) =>
      tx.company.create({ data: { id: COMPANY_A, code: 'RLS_A', name: 'RLS Tenant A' } }),
    );
    await withCompanyProvisioning(client, COMPANY_B, (tx) =>
      tx.company.create({ data: { id: COMPANY_B, code: 'RLS_B', name: 'RLS Tenant B' } }),
    );

    await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.create({
        data: { companyId: COMPANY_A, email: 'alice@rls.test', displayName: 'Alice' },
      }),
    );
    await withTenantContext(client, COMPANY_B, (tx) =>
      tx.user.create({
        data: { companyId: COMPANY_B, email: 'bob@rls.test', displayName: 'Bob' },
      }),
    );
  });

  it('shows a tenant only its own rows', async () => {
    const forA = await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.findMany({ select: { email: true } }),
    );
    const forB = await withTenantContext(client, COMPANY_B, (tx) =>
      tx.user.findMany({ select: { email: true } }),
    );

    expect(forA.map((row) => row.email)).toEqual(['alice@rls.test']);
    expect(forB.map((row) => row.email)).toEqual(['bob@rls.test']);
  });

  it('returns nothing when no tenant context is set', async () => {
    // Fail-closed rather than fail-open: a query that forgot `withTenantContext` must
    // return zero rows, not every tenant's rows.
    await expect(client.user.findMany()).resolves.toEqual([]);
  });

  it('rejects a tenant context that is not a UUID', async () => {
    await expect(
      withTenantContext(client, 'not-a-uuid', (tx) => tx.user.findMany()),
    ).rejects.toThrow(/must be a UUID/);
  });

  it('refuses to create a company outside the provisioning path', async () => {
    // A tenant context alone must not be enough to mint new tenants.
    await expect(
      withTenantContext(client, COMPANY_A, (tx) =>
        tx.company.create({ data: { id: COMPANY_A, code: 'SNEAKY', name: 'Sneaky' } }),
      ),
    ).rejects.toThrow();
  });

  it('hides soft-deleted rows from every read shape', async () => {
    const alice = await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.findUniqueOrThrow({ where: { email: 'alice@rls.test' } }),
    );

    await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.update({ where: { id: alice.id }, data: { deletedAt: new Date() } }),
    );

    const listed = await withTenantContext(client, COMPANY_A, (tx) => tx.user.findMany());
    expect(listed).toEqual([]);

    // `findUnique` takes a unique input and cannot carry a filter, so the extension
    // post-checks the row instead. `findUniqueOrThrow` must raise P2025 rather than
    // return a deleted user.
    const unique = await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.findUnique({ where: { id: alice.id } }),
    );
    expect(unique).toBeNull();

    await expect(
      withTenantContext(client, COMPANY_A, (tx) =>
        tx.user.findUniqueOrThrow({ where: { id: alice.id } }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('counts only visible rows', async () => {
    await withTenantContext(client, COMPANY_A, (tx) =>
      tx.user.updateMany({ where: {}, data: { deletedAt: new Date() } }),
    );

    await expect(client.user.count()).resolves.toBe(0);
  });
});

describe('audit log protection (integration)', () => {
  let client: DatabaseClient;
  let owner: Pool;

  beforeAll(async () => {
    client = createPrismaClient();
    owner = new Pool({
      connectionString: `postgresql://${process.env['POSTGRES_USER'] ?? 'hris'}:${process.env['POSTGRES_PASSWORD']}@localhost:5435/hris`,
      max: 1,
    });
  });

  afterAll(async () => {
    await client.$disconnect();
    await owner.end();
  });

  beforeEach(async () => {
    await owner.query('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_or_delete');
    await owner.query('DELETE FROM audit_logs');
    await owner.query('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_or_delete');
    await owner.query('DELETE FROM users');
    await owner.query('DELETE FROM companies');

    await withCompanyProvisioning(client, COMPANY_A, (tx) =>
      tx.company.create({ data: { id: COMPANY_A, code: 'AUD_A', name: 'Audit Tenant A' } }),
    );
  });

  it('accepts inserts', async () => {
    await expect(
      withTenantContext(client, COMPANY_A, (tx) =>
        tx.auditLog.create({
          data: {
            companyId: COMPANY_A,
            action: 'user.created',
            resource: 'user',
            entryHash: 'hash-1',
          },
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('refuses updates and deletes even for the owning role', async () => {
    // The owner is a superuser, so row-level security cannot be what stops this. The
    // append-only trigger is the last line of defence and is asserted here directly,
    // because "the application role is not allowed to" is a much weaker guarantee.
    // `audit_logs` has no `updated_at`: a row that can never be updated has nothing to
    // record about when it was updated.
    await owner.query(
      `INSERT INTO audit_logs (company_id, action, resource, entry_hash, created_at)
       VALUES ($1, 'user.created', 'user', 'hash-2', now())`,
      [COMPANY_A],
    );

    await expect(owner.query(`UPDATE audit_logs SET action = 'tampered'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(owner.query(`DELETE FROM audit_logs`)).rejects.toThrow(/append-only/);
  });
});

describe('seed idempotency (integration)', () => {
  let client: DatabaseClient;

  beforeAll(async () => {
    client = createPrismaClient();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('does not duplicate rows when the reference data is written twice', async () => {
    // Runs as the owner because the seed connects as the owner: the application role
    // does not exist yet on a fresh volume, which is exactly why the seed precedes
    // `db:grant`.
    const owner = new Pool({
      connectionString: `postgresql://${process.env['POSTGRES_USER'] ?? 'hris'}:${process.env['POSTGRES_PASSWORD']}@localhost:5435/hris`,
      max: 1,
    });

    try {
      const { seedRbac, seedReferenceData } = await import('../seeds/rbac');
      const { PrismaClient } = await import('../src/generated/prisma/client');
      const { PrismaPg } = await import('@prisma/adapter-pg');

      const seedClient = new PrismaClient({
        adapter: new PrismaPg({ connectionString: owner.options.connectionString }),
      });

      await seedReferenceData(seedClient);
      await seedRbac(seedClient);
      const first = await countRows(owner);
      await seedReferenceData(seedClient);
      await seedRbac(seedClient);
      const second = await countRows(owner);

      expect(second).toEqual(first);
      expect(first.countries).toBe(COUNTRY_CODES.length);
      expect(first.roles).toBe(SYSTEM_ROLE_KEYS.length);
      // The permission matrix is RESOURCES x ACTIONS, so a partial seed is detectable
      // rather than merely producing fewer grants than expected.
      expect(first.permissions).toBe(RESOURCES.length * ACTIONS.length);
      await seedClient.$disconnect();
    } finally {
      await owner.end();
    }
  });
});

async function countRows(
  pool: Pool,
): Promise<{ countries: number; currencies: number; roles: number; permissions: number }> {
  const result = await pool.query<{
    countries: number;
    currencies: number;
    roles: number;
    permissions: number;
  }>(`SELECT
        (SELECT count(*) FROM countries)::int AS countries,
        (SELECT count(*) FROM currencies)::int AS currencies,
        (SELECT count(*) FROM roles)::int AS roles,
        (SELECT count(*) FROM permissions)::int AS permissions`);

  return result.rows[0];
}
