import { apiRequest, platformApiRequest, type RequestOptions } from './http-client';

/**
 * Browser-facing API URLs.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
 * they are fixed when the image is built and must be reachable from the user's
 * machine. Never point these at an internal service name such as `api`: the
 * browser cannot resolve it. Server-side calls use `server-config` instead.
 */

export const CLIENT_API_BASE_URL =
  process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3001/api/v1';

export const CLIENT_API_PLATFORM_URL =
  process.env['NEXT_PUBLIC_API_PLATFORM_URL'] ?? 'http://localhost:3001';

/** Calls a versioned business endpoint from the browser. */
export const apiRequestV1 = <TData>(path: string, options?: RequestOptions): Promise<TData> =>
  apiRequest<TData>(CLIENT_API_BASE_URL, path, options);

/** Calls an unversioned platform endpoint from the browser, such as a probe. */
export const platformRequest = <TData>(path: string, options?: RequestOptions): Promise<TData> =>
  platformApiRequest<TData>(CLIENT_API_PLATFORM_URL, path, options);
