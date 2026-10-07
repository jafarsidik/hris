import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { join } from 'node:path';

import {
  buildPostgresUrl,
  missingPostgresVariables,
  readPostgresSettings,
} from './src/connection-string';

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 moved the datasource URL, the migrations path and the seed command out of
 * `package.json` and `schema.prisma` into this file. Paths here are resolved relative
 * to this file, not to the shell's working directory, which is why every path is
 * written as if this file sat in the package root.
 *
 * The file lives beside `schema.prisma` rather than in the repository root so that the
 * schema, the migrations and the generated client are governed by the single
 * `@hris/database` workspace that owns them.
 *
 * `__dirname` is unavailable when the config is evaluated as an ES module, so it is
 * guarded rather than assumed. `process.cwd()` is the documented fallback and is
 * correct for `npm run ... -w @hris/database`, which runs with the package directory
 * as the working directory.
 */
const configDirectory = typeof __dirname === 'string' ? __dirname : process.cwd();

/**
 * Loads the repository `.env`.
 *
 * Prisma 7 no longer loads `.env` itself. Without this, every `npm run db:*` script
 * would depend on the developer having exported the variables by hand. Values already
 * present in the environment win, so CI and container environments are unaffected.
 */
loadEnvFile({ path: join(configDirectory, '..', '.env'), quiet: true });

/**
 * Subcommands that open a database connection.
 *
 * `prisma generate` is deliberately absent: it only compiles the schema into a client
 * and must keep working in a Docker build stage and in CI's `verify` job, neither of
 * which has credentials. `datasource` is therefore omitted entirely when the
 * environment is unconfigured, which Prisma treats as "no connection needed" rather
 * than as an error.
 */
const DATABASE_COMMANDS = new Set(['db', 'migrate', 'studio']);

function invokedCommand(): string | undefined {
  return process.argv.slice(2).find((argument) => !argument.startsWith('-'));
}

const missing = missingPostgresVariables(process.env);

if (missing.length > 0 && DATABASE_COMMANDS.has(invokedCommand() ?? '')) {
  throw new Error(
    `Cannot run \`prisma ${invokedCommand()}\`: PostgreSQL connection is not configured. ` +
      `Missing: ${missing.join(', ')}. Load the variables from .env (see .env.example).`,
  );
}

export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    // Seeding is no longer implicit in Prisma 7; `db:migrate` and `db:reset` do not run
    // it. `db:seed` invokes it explicitly, and the pipeline calls it after `db:deploy`.
    // Transpile-only keeps startup fast; type errors are caught by `npm run typecheck`,
    // which includes the seeds directory.
    seed: 'ts-node --transpile-only --project tsconfig.json seeds/seed.ts',
  },
  datasource:
    missing.length > 0 ? undefined : { url: buildPostgresUrl(readPostgresSettings(process.env)) },
});
