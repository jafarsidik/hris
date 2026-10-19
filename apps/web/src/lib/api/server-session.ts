import 'server-only';

import { cookies } from 'next/headers';

import type { RequestOptions } from './http-client';

/**
 * Header set that carries the browser session to the API.
 *
 * The web server reaches the API over the private container network, so it must
 * forward the caller's `hris_session` cookie explicitly — `credentials: include`
 * means nothing server-side. Without the forwarded cookie every server-rendered
 * API call would arrive unauthenticated and read only what a signed-out visitor
 * may read, which the endpoints answer with 401.
 *
 * Server components and server actions both resolve `cookies()`; reading it in a
 * `force-dynamic` render (or action) is the supported path, which is where every
 * API-backed repository call happens.
 */
export async function sessionRequestOptions(options?: RequestOptions): Promise<RequestOptions> {
  const store = await cookies();
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'hris_session';
  const session = store.get(cookieName)?.value;

  if (session === undefined || session === '') {
    return options ?? {};
  }

  return {
    ...(options ?? {}),
    headers: { ...(options?.headers ?? {}), cookie: `${cookieName}=${session}` },
  };
}
