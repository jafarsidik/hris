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

export interface AppConfiguration {
  readonly environment: NodeEnvironment;
  readonly http: HttpConfig;
  readonly logging: LoggingConfig;
  readonly swagger: SwaggerConfig;
}

export const DEFAULT_HTTP_PORT = 3001;

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

  if (problems.length > 0) {
    throw new ConfigurationError(problems);
  }

  return { environment, http, logging, swagger };
}

/** Converts the configured level into the cumulative level list NestJS expects. */
export function toNestLogLevel(level: AppLogLevel): LogLevel[] {
  return [...NEST_LOG_LEVELS.slice(0, NEST_LOG_LEVELS.indexOf(level) + 1)];
}

export function isProduction(config: AppConfiguration): boolean {
  return config.environment === 'production';
}