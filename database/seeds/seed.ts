/**
 * Seed entry point, wired to `prisma db seed` by `prisma.config.ts`.
 *
 * Order matters in one direction only: reference data before RBAC, so that a failure
 * leaves the database with vocabulary rather than with roles pointing at permissions
 * that do not exist.
 *
 * This connects as the migration owner (`POSTGRES_USER`), not the application role. The
 * tables written here have no row-level security, so the application role could write
 * them too — but the application role does not exist yet on a fresh volume, and a seed
 * that depends on the grant script it is meant to precede would deadlock the bootstrap.
 * Run order on a new environment is therefore:
 *
 *     db:deploy  ->  db:seed  ->  db:grant
 */
import { config as loadEnvFile } from 'dotenv';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import { buildPostgresUrl, readPostgresSettings } from '../src/connection-string';
import { PrismaClient } from '../src/generated/prisma/client';

import { seedRbac, seedReferenceData } from './rbac';

loadEnvFile({ path: join(__dirname, '..', '..', '.env'), quiet: true });

async function main(): Promise<void> {
  const client = new PrismaClient({
    adapter: new PrismaPg(buildPostgresUrl(readPostgresSettings(process.env))),
    log: ['warn', 'error'],
  });

  try {
    const reference = await seedReferenceData(client);
    const rbac = await seedRbac(client);

    console.log(
      `Seeded ${reference.countries} countries, ${reference.currencies} currencies, ` +
        `${rbac.roles} roles, ${rbac.permissions} permissions and ${rbac.grants} grants.`,
    );
    console.log(
      'Only SYSTEM_ADMIN has grants so far; the remaining system roles are seeded ' +
        'without permissions until the modules they govern exist.',
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
