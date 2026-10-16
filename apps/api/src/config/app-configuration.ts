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

/**
 * Authentication and session policy (ADR 0010 opaque tokens, account lockout,
 * login rate limiting).
 */
export interface AuthConfig {
  /** Absolute session lifetime. A fresh session is created on every sign-in. */
  readonly sessionTtlSeconds: number;
  /** The `hris_session` HttpOnly cookie. */
  readonly cookieName: string;
  /** Consecutive failures that lock an account before prompting sign-in again. */
  readonly maxFailedAttempts: number;
  /** Duration an account stays locked after reaching the failure limit. */
  readonly lockoutSeconds: number;
  /** Per-IP successful-login attempts per window defensive upper bound. */
  readonly loginRateLimitPerMinute: number;
}

/** Platform-wide request ceilings applied per principal. */
export interface RateLimitConfig {
  /**
   * Requests a single developer API client may make per minute. Session-authenticated
   * users are not capped here; this bounds a machine principal that can otherwise run
   * unbounded. `0` disables the check.
   */
  readonly apiRequestsPerMinute: number;
}

/**
 * At-rest encryption keys for credentials the platform must keep but must never
 * store in plain text (TOTP secrets, SSO client secrets / SAML private keys).
 *
 * Each value is `null` until the corresponding env var is present, so the feature
 * degrades to a clear, boot-time-facing error when configured without a key rather
 * than silently storing plaintext.
 */
export interface CredentialSecretsConfig {
  readonly mfaEncryptionKey: string | null;
  readonly ssoEncryptionKey: string | null;
  /**
   * Encrypts webhook signing secrets at rest. `null` until `WEBHOOK_ENCRYPTION_KEY`
   * is set; registering a webhook endpoint then fails loudly rather than storing a
   * plaintext signing credential.
   */
  readonly webhookEncryptionKey: string | null;
  /**
   * The externally reachable base URL of the API. Required for OIDC/SAML callbacks,
   * SP metadata and discovery documents. `null` until `API_PUBLIC_URL` is set.
   */
  readonly externalBaseUrl: string | null;
}

/** WebAuthn relying-party identity (passkeys). Disabled until fully configured. */
export interface WebAuthnConfig {
  readonly enabled: boolean;
  readonly rpId: string;
  readonly rpName: string;
  readonly origin: string;
}

/**
 * S3-compatible object storage (RustFS in development).
 *
 * Two endpoints, not one: the API reaches storage over the private network while the
 * browser reaches it through the published host port, so a presigned URL must be signed
 * for the endpoint the *browser* will call, not the one the API uses. `publicEndpoint`
 * defaults to `endpoint`, which is correct whenever both run on the same host.
 */
export interface StorageConfig {
  /** Endpoint used for server-side HEAD/DELETE requests. */
  readonly endpoint: string;
  /** Endpoint embedded in presigned URLs returned to the browser. */
  readonly publicEndpoint: string;
  readonly bucket: string;
  readonly region: string;
  readonly accessKey: string;
  readonly secretKey: string;
  /** Lifetime of a presigned URL, in seconds. */
  readonly signedUrlTtlSeconds: number;
}

export interface AiConfig {
  /** Global master switch. When false, all AI calls return UNAVAILABLE. */
  readonly enabled: boolean;
  /** Provider id (openai/azure/bedrock/local). */
  readonly provider: string;
  /** Provider API key (only required when enabled). */
  readonly apiKey: string | null;
  /** Pinned model id. */
  readonly model: string;
  /** Base URL for OpenAI-compatible endpoints. */
  readonly baseUrl: string;
  /** Hard timeout per request in ms. */
  readonly timeoutMs: number;
}

export interface AppConfiguration {
  readonly environment: NodeEnvironment;
  /**
   * Where the browser-facing web app lives. Used to send the browser back after an
   * SSO callback, which lands on the API origin before a session cookie is set.
   */
  readonly webAppUrl: string;
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
  readonly auth: AuthConfig;
  readonly rateLimit: RateLimitConfig;
  readonly secrets: CredentialSecretsConfig;
  readonly webauthn: WebAuthnConfig;
  /**
   * `null` when object storage credentials are absent. Optional for the same reason as
   * the database: a process that refuses to boot cannot report itself unhealthy. A file
   * route then answers 503 rather than failing at startup.
   */
  readonly storage: StorageConfig | null;
  readonly ai: AiConfig;
}

export const DEFAULT_HTTP_PORT = 3001;

export const DEFAULT_DATABASE_POOL_SIZE = 10;
export const DEFAULT_REDIS_DB = 0;

/** Authentication defaults; the env overrides are defined in `readAuthConfig`. */
export const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const DEFAULT_SESSION_COOKIE_NAME = 'hris_session';
export const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
export const DEFAULT_LOCKOUT_SECONDS = 15 * 60;
export const DEFAULT_LOGIN_RATE_LIMIT_PER_MINUTE = 20;
export const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 600;

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

/** Reads a string as `null` when unset or blank, so an absent secret is explicit. */
const readNullable = (env: EnvSource, key: string): string | null => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    return null;
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
    corsOrigins: readList(env, 'CORS_ORIGINS', [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
    ]),
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

  const auth: AuthConfig = {
    sessionTtlSeconds: readInteger(
      env,
      'AUTH_SESSION_TTL_SECONDS',
      DEFAULT_SESSION_TTL_SECONDS,
      { min: 60, max: 30 * 24 * 60 * 60 },
      problems,
    ),
    cookieName: readString(env, 'AUTH_SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME),
    maxFailedAttempts: readInteger(
      env,
      'AUTH_MAX_FAILED_ATTEMPTS',
      DEFAULT_MAX_FAILED_ATTEMPTS,
      { min: 1, max: 100 },
      problems,
    ),
    lockoutSeconds: readInteger(
      env,
      'AUTH_LOCKOUT_SECONDS',
      DEFAULT_LOCKOUT_SECONDS,
      { min: 1, max: 7 * 24 * 60 * 60 },
      problems,
    ),
    loginRateLimitPerMinute: readInteger(
      env,
      'AUTH_LOGIN_RATE_LIMIT_PER_MINUTE',
      DEFAULT_LOGIN_RATE_LIMIT_PER_MINUTE,
      { min: 1, max: 1000 },
      problems,
    ),
  };

  const rateLimit: RateLimitConfig = {
    apiRequestsPerMinute: readInteger(
      env,
      'API_RATE_LIMIT_PER_MINUTE',
      DEFAULT_API_RATE_LIMIT_PER_MINUTE,
      { min: 0, max: 100_000 },
      problems,
    ),
  };

  const secrets: CredentialSecretsConfig = {
    mfaEncryptionKey: readNullable(env, 'AUTH_MFA_ENCRYPTION_KEY'),
    ssoEncryptionKey: readNullable(env, 'SSO_ENCRYPTION_KEY'),
    webhookEncryptionKey: readNullable(env, 'WEBHOOK_ENCRYPTION_KEY'),
    externalBaseUrl: readNullable(env, 'API_PUBLIC_URL'),
  };

  const webAppUrl = readString(env, 'WEB_APP_URL', 'http://localhost:3000');

  const webauthn: WebAuthnConfig = {
    enabled: readBoolean(env, 'WEBAUTHN_ENABLED', false),
    rpId: readString(env, 'WEBAUTHN_RP_ID', 'localhost'),
    rpName: readString(env, 'WEBAUTHN_RP_NAME', 'HRIS'),
    origin: readString(env, 'WEBAUTHN_ORIGIN', 'http://localhost:3000'),
  };

  const storage = readStorageConfig(env, problems);

  if (problems.length > 0) {
    throw new ConfigurationError(problems);
  }

  return {
    environment,
    webAppUrl,
    http,
    logging,
    swagger,
    database,
    redis,
    auth,
    rateLimit,
    secrets,
    webauthn,
    storage,
    ai: readAiConfig(env),
  };
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

/**
 * Reads the object-storage settings, or `null` when `STORAGE_ACCESS_KEY`/`_SECRET_KEY`
 * are absent. Half-configured credentials are an error for the same reason a half-
 * configured database is: a missing half is a typo, and silently disabling storage turns
 * it into a runtime 503 instead of a boot failure.
 *
 * The endpoint defaults to localhost because that is where RustFS publishes during local
 * development; `STORAGE_PUBLIC_ENDPOINT` overrides only the origin used inside presigned
 * URLs, so a containerised API can sign for the host-facing address.
 */
function readStorageConfig(env: EnvSource, problems: string[]): StorageConfig | null {
  const accessKey = env['STORAGE_ACCESS_KEY']?.trim() ?? '';
  const secretKey = env['STORAGE_SECRET_KEY']?.trim() ?? '';

  if (accessKey === '' && secretKey === '') {
    return null;
  }

  if (accessKey === '' || secretKey === '') {
    problems.push(
      'STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be set together ' +
        '(object storage is disabled otherwise)',
    );
    return null;
  }

  const endpoint = readString(env, 'STORAGE_ENDPOINT', 'http://localhost:9000').replace(/\/+$/, '');

  return {
    endpoint,
    publicEndpoint: readString(env, 'STORAGE_PUBLIC_ENDPOINT', endpoint).replace(/\/+$/, ''),
    bucket: readString(env, 'STORAGE_BUCKET', 'hris-documents'),
    region: readString(env, 'STORAGE_REGION', 'us-east-1'),
    accessKey,
    secretKey,
    signedUrlTtlSeconds: readInteger(
      env,
      'STORAGE_SIGNED_URL_TTL_SECONDS',
      900,
      { min: 60, max: 604800 },
      problems,
    ),
  };
}

export function isProduction(config: AppConfiguration): boolean {
  return config.environment === 'production';
}

function readAiConfig(env: EnvSource): AiConfig {
  return {
    enabled: readBoolean(env, 'AI_ENABLED', false),
    provider: readString(env, 'AI_PROVIDER', 'openai').trim().toLowerCase(),
    apiKey: readNullable(env, 'AI_API_KEY'),
    model: readString(env, 'AI_MODEL', 'gpt-4.1-mini'),
    baseUrl: readString(env, 'AI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    timeoutMs: readInteger(env, 'AI_TIMEOUT_MS', 60000, { min: 1000, max: 300000 }, []),
  };
}
