import 'server-only';

import { apiRequest, platformApiRequest, type RequestOptions } from './http-client';

/**
 * Server-side API URLs, resolved at runtime.
 *
 * These deliberately differ from the `NEXT_PUBLIC_*` values used by the browser.
 * Inside a container the API is reached over the private network by service name
 * (`http://api:3001`), which the browser cannot resolve; conversely a browser URL
 * such as `http://localhost:3001` points back at the web container itself when
 * fetched on the server. One image therefore serves any environment by changing
 * these variables alone, with no rebuild.
 *
 * `API_PLATFORM_URL` / `API_BASE_URL` fall back to the public values so local
 * `next dev` on the host works with no extra configuration.
 *
 * `server-only` makes importing this from a client component a build error rather
 * than a silent `undefined`, which is the failure this split exists to prevent.
 */

export const SERVER_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001/api/v1';

export const SERVER_API_PLATFORM_URL =
  process.env.API_PLATFORM_URL ??
  process.env.NEXT_PUBLIC_API_PLATFORM_URL ??
  'http://localhost:3001';

/** Calls a versioned business endpoint from the server. */
export const serverApiRequestV1 = <TData>(path: string, options?: RequestOptions): Promise<TData> =>
  apiRequest<TData>(SERVER_API_BASE_URL, path, options);

/** Calls an unversioned platform endpoint from the server, such as a probe. */
export const serverPlatformRequest = <TData>(
  path: string,
  options?: RequestOptions,
): Promise<TData> => platformApiRequest<TData>(SERVER_API_PLATFORM_URL, path, options);
