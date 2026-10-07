import type { LogLevel } from '@nestjs/common';

import { DEFAULT_API_VERSION, HEALTH_PATHS } from '@hris/config';

import { ConfigurationError } from './configuration.error';

/** Deployment environments. Anything not listed is rejected at boot. */
export const NODE_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const LOG_LEVELS = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
export type AppLogLevel = (typeof LOG_LEVELS)[number];

export interface HttpConfig {
  readonly host: string;
  readonly port: number;
  /** Exact browser origins permitted to call the API. */
  readonly corsOrigins: readonly string[];
  readonly globalPrefix: string;
  readonly defaultVersion: string;
  /** Health probes stay unprefixed and unversioned so orchestrators keep working. */
  readonly healthExclusions: readonly string[];
  /**
   * Number of reverse proxies in front of the API that are trusted to set
   * `X-Forwarded-For`. Zero means the socket address is used verbatim.
   *
   * This must only be raised when every hop is an infrastructure component the
   * team controls; otherwise a client can spoof the source address recorded in
   * the audit log and login history.
   */
  readonly trustProxyHops: number;
}

export interface LoggingConfig {
  readonly level: AppLogLevel;
}

export interface SwaggerConfig {
  readonly enabled: boolean;
  readonly path: string;
}

/**
 * PostgreSQL settings the API connects with.
 *
 * `user` and `password` are the application role, not the migration owner. The API must
 * never run queries as a superuser, because a superuser bypasses row-level security
 * unconditionally and every tenant policy would become decorative.
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  /**
   * Connections per API instance.
   *
   * Bounded because the total is multiplied by the replica count, and an unbounded
   * default is the usual way a deployment exhausts the database's connection slots.
   */
  readonly poolSize: number;
}

export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  /** `null` when Redis runs without authentication, which is refused outside tests. */
  readonly password: string | null;
  readonly db: number;
}

export interface AppConfiguration {
  readonly environment: NodeEnvironment;
  readonly http: HttpConfig;
  readonly logging: LoggingConfig;
  readonly swagger: SwaggerConfig;
  /**
   * `null` when the application role's credentials are absent.
   *
   * Optional rather than fatal because liveness must keep answering while a dependency
   * is missing: a process that refuses to start cannot report itself unhealthy, so
   * orchestrators never learn why. Readiness turns this into a 503 instead.
   */
  readonly database: DatabaseConfig | null;
  readonly redis: RedisConfig | null;
}

export const DEFAULT_HTTP_PORT = 3001;

export const DEFAULT_DATABASE_POOL_SIZE = 10;
export const DEFAULT_REDIS_DB = 0;

/** Defaults shared with `@hris/database` so the two cannot disagree about ports. */
const POSTGRES_DEFAULTS = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5435',
  POSTGRES_DB: 'hris',
} as const;

const REDIS_DEFAULTS = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6381',
} as const;

/**
 * Bind every interface. `main.ts` maps this to an unspecified host so Node opens a
 * dual-stack socket, which accepts both IPv4 and IPv6 clients. Binding `0.0.0.0`
 * literally would be IPv4-only and silently drop IPv6 traffic.
 */
export const WILDCARD_HOST = '0.0.0.0';

/** NestJS log levels ordered from least to most verbose. */
const NEST_LOG_LEVELS: readonly AppLogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

type EnvSource = Record<string, string | undefined>;

const readString = (env: EnvSource, key: string, fallback: string): string => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim();
};

const readInteger = (
  env: EnvSource,
  key: string,
  fallback: number,
  bounds: { min: number; max: number },
  problems: string[],
): number => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    problems.push(`${key} must be an integer (received "${raw}")`);
    return fallback;
  }
  if (parsed < bounds.min || parsed > bounds.max) {
    problems.push(`${key} must be between ${bounds.min} and ${bounds.max} (received ${parsed})`);
    return fallback;
  }
  return parsed;
};

const readEnum = <TValue extends string>(
  env: EnvSource,
  key: string,
  allowed: readonly TValue[],
  fallback: TValue,
  problems: string[],
): TValue => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = raw.trim();
  if (!allowed.includes(value as TValue)) {
    problems.push(`${key} must be one of ${allowed.join(', ')} (received "${value}")`);
    return fallback;
  }
  return value as TValue;
};

const readList = (env: EnvSource, key: string, fallback: readonly string[]): readonly string[] => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const readBoolean = (env: EnvSource, key: string, fallback: boolean): boolean => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim() === 'true' || raw.trim() === '1';
};

/**
 * Parses and validates the process environment into a typed configuration tree.
 *
 * Every runtime value the application depends on is resolved here. No other
 * module reads `process.env`, which keeps configuration auditable in one place
 * and prevents a module from silently acquiring an environment dependency.
 * Validation is exhaustive: all problems are reported together so a
 * misconfigured deployment is fixed in a single pass.
 */
export function parseConfiguration(env: EnvSource = process.env): AppConfiguration {
  const problems: string[] = [];

  const environment = readEnum(env, 'NODE_ENV', NODE_ENVIRONMENTS, 'development', problems);

  const host = readString(env, 'API_HOST', WILDCARD_HOST);

  // `localhost` is rejected outright. Node resolves it through the system
  // resolver, which on most modern hosts prefers ::1, so the server ends up bound
  // to the IPv6 loopback only. IPv4 clients then get ECONNREFUSED and container
  // health checks fail, while the process still logs a healthy startup message.
  // Requiring an explicit interface makes that failure impossible to misread.
  if (host === 'localhost') {
    problems.push(
      'API_HOST must be a concrete interface such as 0.0.0.0 or 127.0.0.1, not "localhost" ' +
        '(it resolves to ::1 on most hosts, leaving IPv4 clients unable to connect)',
    );
  }

  const http: HttpConfig = {
    host,
    port: readInteger(env, 'API_PORT', DEFAULT_HTTP_PORT, { min: 1, max: 65535 }, problems),
    corsOrigins: readList(env, 'CORS_ORIGINS', ['http://localhost:3000']),
    globalPrefix: 'api',
    defaultVersion: DEFAULT_API_VERSION,
    // NestJS matches these patterns against the unprefixed route path.
    healthExclusions: Object.values(HEALTH_PATHS).map((path) => path.replace(/^\//, '')),
    trustProxyHops: readInteger(env, 'TRUST_PROXY_HOPS', 0, { min: 0, max: 10 }, problems),
  };

  const logging: LoggingConfig = {
    level: readEnum(
      env,
      'LOG_LEVEL',
      LOG_LEVELS,
      environment === 'production' ? 'log' : 'debug',
      problems,
    ),
  };

  const swagger: SwaggerConfig = {
    // OpenAPI is disabled in production by default because it enumerates the
    // entire attack surface. Staging keeps it available for API consumers.
    enabled: readBoolean(env, 'SWAGGER_ENABLED', environment !== 'production'),
    path: '/api/docs',
  };

  const database = readDatabaseConfig(env, problems);
  const redis = readRedisConfig(env, problems);

  if (problems.length > 0) {
    throw new ConfigurationError(problems);
  }

  return { environment, http, logging, swagger, database, redis };
}

/** Converts the configured level into the cumulative level list NestJS expects. */
export function toNestLogLevel(level: AppLogLevel): LogLevel[] {
  return [...NEST_LOG_LEVELS.slice(0, NEST_LOG_LEVELS.indexOf(level) + 1)];
}

/**
 * Reads the PostgreSQL settings, or `null` when the application role is not configured.
 *
 * Half-configured credentials are treated as an error rather than as "unconfigured": a
 * missing password next to a present username is a typo, and silently running without
 * the database turns that typo into a readiness failure instead of a boot failure.
 */
function readDatabaseConfig(env: EnvSource, problems: string[]): DatabaseConfig | null {
  const user = env['POSTGRES_APP_USER']?.trim() ?? '';
  const password = env['POSTGRES_APP_PASSWORD']?.trim() ?? '';

  if (user === '' && password === '') {
    return null;
  }

  if (user === '' || password === '') {
    problems.push(
      'POSTGRES_APP_USER and POSTGRES_APP_PASSWORD must be set together ' +
        '(run "npm run db:grant -w @hris/database" to provision the application role)',
    );
    return null;
  }

  return {
    host: readString(env, 'POSTGRES_HOST', POSTGRES_DEFAULTS.POSTGRES_HOST),
    port: readInteger(
      env,
      'POSTGRES_PORT',
      Number.parseInt(POSTGRES_DEFAULTS.POSTGRES_PORT, 10),
      { min: 1, max: 65535 },
      problems,
    ),
    database: readString(env, 'POSTGRES_DB', POSTGRES_DEFAULTS.POSTGRES_DB),
    user,
    password,
    poolSize: readInteger(
      env,
      'DB_POOL_SIZE',
      DEFAULT_DATABASE_POOL_SIZE,
      { min: 1, max: 100 },
      problems,
    ),
  };
}

/**
 * Reads the Redis settings, or `null` when `REDIS_PASSWORD` is absent.
 *
 * Redis is only treated as configured when a password is present. `redis:7-alpine` in
 * `docker-compose.yml` requires one via `${REDIS_PASSWORD:?}`, so an unauthenticated
 * Redis is a sandbox, not a supported deployment.
 */
function readRedisConfig(env: EnvSource, problems: string[]): RedisConfig | null {
  const password = env['REDIS_PASSWORD']?.trim() ?? '';

  if (password === '') {
    return null;
  }

  return {
    host: readString(env, 'REDIS_HOST', REDIS_DEFAULTS.REDIS_HOST),
    port: readInteger(
      env,
      'REDIS_PORT',
      Number.parseInt(REDIS_DEFAULTS.REDIS_PORT, 10),
      { min: 1, max: 65535 },
      problems,
    ),
    password,
    db: readInteger(env, 'REDIS_DB', DEFAULT_REDIS_DB, { min: 0, max: 15 }, problems),
  };
}

export function isProduction(config: AppConfiguration): boolean {
  return config.environment === 'production';
}
