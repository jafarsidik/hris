import 'server-only';

import { redirect } from 'next/navigation';

import {
  ApiRequestError,
  apiRequest,
  platformApiRequest,
  type RequestOptions,
} from './http-client';

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
  withSessionRedirect(() => apiRequest<TData>(SERVER_API_BASE_URL, path, options));

/**
 * Turns a 401 from the API into a trip to the sign-in page.
 *
 * A server component cannot render anything useful from an unauthenticated call, and it
 * cannot explain itself either: Next serialises a thrown server error to the browser as an
 * opaque digest, so the error boundary downstream can only say "something went wrong" and
 * print a reference number. That is what a reader whose session had expired saw on
 * `/employees` — "Something went wrong … Reference: 169568600" — while the same reader on
 * `/` was correctly sent to the sign-in card, because `/` redirects client-side.
 *
 * Redirecting here is the one place that still knows the cause. Only `UNAUTHENTICATED` is
 * treated this way: a 403 is a real answer about this reader and belongs to the page, and
 * a 5xx is a fault the error boundary should report.
 *
 * The `redirect()` call sits inside the `catch`, and throws its own `NEXT_REDIRECT` error
 * on the way out; nothing here catches it again, so it reaches the router.
 */
async function withSessionRedirect<TData>(call: () => Promise<TData>): Promise<TData> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'UNAUTHENTICATED') {
      redirect('/login');
    }

    throw error;
  }
}

/** Calls an unversioned platform endpoint from the server, such as a probe. */
export const serverPlatformRequest = <TData>(
  path: string,
  options?: RequestOptions,
): Promise<TData> => platformApiRequest<TData>(SERVER_API_PLATFORM_URL, path, options);
