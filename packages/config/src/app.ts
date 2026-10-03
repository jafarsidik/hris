/**
 * Identity of the platform itself.
 *
 * Kept free of environment lookups on purpose: reading environment variables
 * is an infrastructure concern owned by each application (the API validates its
 * own configuration at boot, Next.js reads `process.env` at build time).
 * Duplicating an env reader here would create two sources of truth.
 */

export const APP_NAME = 'HRIS';
export const APP_SLUG = 'hris';
export const APP_DESCRIPTION = 'Enterprise Human Resources Information System';

/** Global API prefix. Combined with the URI version below it forms `/api/v1`. */
export const API_PREFIX = 'api';

/** Supported URI versions. New versions are added, never silently replaced. */
export const API_VERSIONS = ['1'] as const;

export type ApiVersion = (typeof API_VERSIONS)[number];

export const DEFAULT_API_VERSION: ApiVersion = '1';

export function buildApiPath(path: string, version: ApiVersion = DEFAULT_API_VERSION): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `/${API_PREFIX}/v${version}${normalisedPath}`;
}

/** Health endpoints are intentionally unversioned so probes stay stable. */
export const HEALTH_PATHS = Object.freeze({
  root: '/health',
  live: '/health/live',
  ready: '/health/ready',
});

/** Well-known headers. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';