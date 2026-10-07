/**
 * Grants the application role access to the platform schema.
 *
 * Why this is a script and not part of `docker/postgres/init` or a migration:
 *
 *   * A migration cannot contain it, because the role name comes from the
 *     environment and migrations are committed once and replayed verbatim.
 *   * `docker/postgres/init` runs exactly once, on an empty volume. Anything it
 *     grants is silently lost the moment a schema is dropped and recreated, which
 *     is a routine thing to do while developing.
 *
 * So it lives here: idempotent, re-runnable, and it runs against the database that
 * actually exists. `db:grant` is invoked after `db:deploy`.
 *
 * The application role is deliberately granted no ownership of anything. A table
 * owner bypasses its own row-level security policies unless FORCE ROW LEVEL
 * SECURITY is set, and the migrations do set it — but owning nothing removes the
 * question entirely, which is why this role is separate from the migration role.
 */

import { config as loadEnvFile } from 'dotenv';
import { join } from 'node:path';
import { escapeIdentifier, escapeLiteral, Pool } from 'pg';

import {
  buildPostgresUrl,
  missingPostgresVariables,
  readPostgresSettings,
} from '../src/connection-string';

// The repository `.env` lives two directories up. Values already present in the
// environment win, so CI and container environments are unaffected.
loadEnvFile({ path: join(__dirname, '..', '..', '.env'), quiet: true });

// Role DDL cannot take bind parameters — PostgreSQL rejects `CREATE ROLE ... $1` —
// so the role name and password are escaped with pg's own helpers instead. The
// password is operator-supplied rather than attacker-supplied, but a generated value
// can contain a quote, and an unescaped one here would be a syntax error at best.
async function main(): Promise<void> {
  const environment = {
    ...process.env,
    POSTGRES_USER: process.env['POSTGRES_USER'] ?? 'hris',
  };

  const missing = missingPostgresVariables(environment);
  const missingAppRole = [
    ...(process.env['POSTGRES_APP_USER'] ? [] : ['POSTGRES_APP_USER']),
    ...(process.env['POSTGRES_APP_PASSWORD'] ? [] : ['POSTGRES_APP_PASSWORD']),
  ];

  if (missing.length > 0 || missingAppRole.length > 0) {
    throw new Error(
      `Cannot grant application privileges. Missing: ${[...missing, ...missingAppRole].join(', ')}.`,
    );
  }

  const ownerRole = readPostgresSettings(environment).user;
  const applicationRole = process.env['POSTGRES_APP_USER'] as string;
  const applicationPassword = process.env['POSTGRES_APP_PASSWORD'] as string;

  const pool = new Pool({
    connectionString: buildPostgresUrl(readPostgresSettings(environment)),
    max: 1,
  });

  const applicationRoleIdentifier = escapeIdentifier(applicationRole);
  const ownerRoleIdentifier = escapeIdentifier(ownerRole);
  const passwordLiteral = escapeLiteral(applicationPassword);

  try {
    // The role may already exist: the bootstrap in docker/postgres/init creates it on
    // a fresh volume, and this script is safe to re-run against an existing database.
    const existing = await pool.query<{ rolname: string }>(
      'SELECT rolname FROM pg_roles WHERE rolname = $1',
      [applicationRole],
    );

    if (existing.rowCount === 0) {
      await pool.query(
        `CREATE ROLE ${applicationRoleIdentifier} LOGIN NOSUPERUSER NOBYPASSRLS ` +
          `PASSWORD ${passwordLiteral}`,
      );
      console.log(`Created application role "${applicationRole}".`);
    } else {
      await pool.query(
        `ALTER ROLE ${applicationRoleIdentifier} LOGIN NOSUPERUSER NOBYPASSRLS ` +
          `PASSWORD ${passwordLiteral}`,
      );
      console.log(`Application role "${applicationRole}" already exists; attributes enforced.`);
    }

    // Privileges on tables that already exist.
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${applicationRoleIdentifier}`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${applicationRoleIdentifier}`,
    );
    await pool.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${applicationRoleIdentifier}`,
    );

    // Privileges on tables created by later migrations.
    await pool.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRoleIdentifier} IN SCHEMA public ` +
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${applicationRoleIdentifier}`,
    );
    await pool.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRoleIdentifier} IN SCHEMA public ` +
        `GRANT USAGE, SELECT ON SEQUENCES TO ${applicationRoleIdentifier}`,
    );

    console.log(
      `Application role "${applicationRole}" can read and write public schema tables owned by "${ownerRole}".`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
