/**
 * Single place that turns the documented `POSTGRES_*` environment contract into a
 * PostgreSQL connection URL.
 *
 * Two consumers need that URL and they must never disagree:
 *
 * 1. `prisma.config.ts`, which the Prisma CLI loads for migrations and seeding.
 * 2. `createPrismaClient()`, which the API uses at runtime.
 *
 * The alternative — introducing a `DATABASE_URL` variable — was rejected because
 * `DATABASE.md` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`,
 * `POSTGRES_USER` and `POSTGRES_PASSWORD` as the contract, and documents the host
 * versus container split as "the single most common cause of connection refused" in
 * this project. Composing the URL keeps that contract intact instead of replacing
 * it with a second source of truth.
 *
 * This module deliberately has no imports. `prisma.config.ts` is loaded before
 * anything in this package is compiled, so anything it pulls in must be resolvable
 * from TypeScript source with no build step.
 */

/** Connection settings required to reach PostgreSQL. */
export interface PostgresConnectionSettings {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/** The `POSTGRES_*` variables this project reads. */
export interface PostgresEnvironment {
  readonly POSTGRES_HOST?: string | undefined;
  readonly POSTGRES_PORT?: string | undefined;
  readonly POSTGRES_DB?: string | undefined;
  readonly POSTGRES_USER?: string | undefined;
  readonly POSTGRES_PASSWORD?: string | undefined;
  readonly POSTGRES_APP_USER?: string | undefined;
  readonly POSTGRES_APP_PASSWORD?: string | undefined;
}

/**
 * Defaults for everything except the password.
 *
 * `5435` is the published host port rather than the container port `5432`, matching
 * `docker-compose.yml` and the table in `DATABASE.md`. Compose overrides the host
 * and port for processes inside the network, where the published port does not
 * exist.
 */
export const POSTGRES_DEFAULTS = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5435',
  POSTGRES_DB: 'hris',
  POSTGRES_USER: 'hris',
} as const;

/**
 * Reports which required variables are absent, for an error message that names them.
 *
 * Returning the names rather than a generic failure matters because the most common
 * cause is a shell that never loaded `.env`, and "connection refused" does not point
 * at that.
 */
export function missingPostgresVariables(environment: PostgresEnvironment): readonly string[] {
  const missing: string[] = [];

  if (!environment.POSTGRES_PASSWORD) {
    missing.push('POSTGRES_PASSWORD');
  }

  if (environment.POSTGRES_PORT !== undefined) {
    const { port } = parsePort(environment.POSTGRES_PORT);
    if (port === undefined) {
      missing.push('POSTGRES_PORT (not a valid port number)');
    }
  }

  return missing;
}

function parsePort(raw: string): { port: number | undefined } {
  if (!/^\d+$/.test(raw)) {
    return { port: undefined };
  }

  const port = Number.parseInt(raw, 10);
  return { port: port > 0 && port <= 65535 ? port : undefined };
}

/**
 * Reads the connection settings, applying documented defaults.
 *
 * Throws when the password is missing rather than returning a partial result: a URL
 * without credentials fails later inside the driver, where the cause is obscured.
 */
export function readPostgresSettings(environment: PostgresEnvironment): PostgresConnectionSettings {
  const missing = missingPostgresVariables(environment);
  if (missing.length > 0) {
    throw new Error(
      `PostgreSQL connection is not configured. Missing: ${missing.join(', ')}. ` +
        'Load the variables from .env (see .env.example) before running this command.',
    );
  }

  const { port } = parsePort(environment.POSTGRES_PORT ?? POSTGRES_DEFAULTS.POSTGRES_PORT);

  return {
    host: environment.POSTGRES_HOST ?? POSTGRES_DEFAULTS.POSTGRES_HOST,
    port: port ?? Number.parseInt(POSTGRES_DEFAULTS.POSTGRES_PORT, 10),
    database: environment.POSTGRES_DB ?? POSTGRES_DEFAULTS.POSTGRES_DB,
    user: environment.POSTGRES_USER ?? POSTGRES_DEFAULTS.POSTGRES_USER,
    password: environment.POSTGRES_PASSWORD ?? '',
  };
}

/**
 * Reports which application-role variables are absent.
 *
 * Kept separate from {@link missingPostgresVariables} because the two roles are not
 * interchangeable, and a caller that wants the owner role should not be told the
 * application role is missing.
 */
export function missingApplicationPostgresVariables(
  environment: PostgresEnvironment,
): readonly string[] {
  const missing: string[] = [];

  if (!environment.POSTGRES_APP_USER) {
    missing.push('POSTGRES_APP_USER');
  }

  if (!environment.POSTGRES_APP_PASSWORD) {
    missing.push('POSTGRES_APP_PASSWORD');
  }

  return missing;
}

/**
 * Reads the connection settings the API should use.
 *
 * These deliberately point at the application role rather than `POSTGRES_USER`. That
 * variable names a superuser, and a superuser bypasses row-level security no matter
 * what the policies say, so connecting with it would make every tenant policy in the
 * migration inert while the tests still passed.
 *
 * There is no fallback to the owner credentials. A missing `POSTGRES_APP_*` is a
 * deployment error that has to be loud, because the alternative — quietly connecting
 * as a superuser — fails open instead of closed.
 */
export function readApplicationPostgresSettings(
  environment: PostgresEnvironment,
): PostgresConnectionSettings {
  const missing = [
    ...missingApplicationPostgresVariables(environment),
    ...missingPostgresVariables(environment),
  ];

  if (missing.length > 0) {
    throw new Error(
      `Application database credentials are not configured. Missing: ${missing.join(', ')}. ` +
        'Run "npm run db:grant -w @hris/database" to create the application role, then load ' +
        'the variables from .env (see .env.example).',
    );
  }

  const shared = readPostgresSettings(environment);

  return {
    host: shared.host,
    port: shared.port,
    database: shared.database,
    user: environment.POSTGRES_APP_USER ?? '',
    password: environment.POSTGRES_APP_PASSWORD ?? '',
  };
}

/**
 * Builds the connection URL.
 *
 * The user and password are percent encoded because a generated password may
 * contain `@`, `:` or `/`, any of which would otherwise be parsed as URL structure
 * and produce a confusing authentication failure.
 */
export function buildPostgresUrl(settings: PostgresConnectionSettings): string {
  const user = encodeURIComponent(settings.user);
  const password = encodeURIComponent(settings.password);

  return `postgresql://${user}:${password}@${settings.host}:${settings.port}/${settings.database}`;
}

/**
 * Replaces the password so a connection URL can appear in a log or an error message.
 *
 * Connection strings reach log aggregation through driver errors and stack traces.
 * Prisma's own message redaction cannot be relied on for every code path, so the
 * value is stripped here before it leaves this package.
 */
export function redactPostgresUrl(url: string): string {
  return url.replace(/(\/\/[^:]*:)[^@]*@/, '$1***@');
}
