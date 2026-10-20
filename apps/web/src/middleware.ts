import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content-Security-Policy.
 *
 * A static CSP cannot be used without `'unsafe-inline'` in `script-src`, because
 * Next.js emits inline bootstrap and hydration scripts. That directive
 * neutralises the main benefit of a CSP: it would let any injected inline script
 * run. So a nonce is minted per request and applied to Next's own scripts, which
 * lets `script-src` stay strict.
 *
 * The policy is returned on the request as well as the response. Next reads the
 * request header to discover the nonce and attaches it to the scripts it renders;
 * returning it on the response alone would leave every inline script blocked.
 */

/** Only these origins may be contacted; CSP source lists take origins, not paths. */
const apiOrigin = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_PLATFORM_URL ?? 'http://localhost:3001';
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed value must not silently widen the policy to '*'.
    return 'http://localhost:3001';
  }
};

/**
 * The object store the browser talks to directly.
 *
 * File uploads are presigned PUTs and downloads are presigned GETs, both aimed at the
 * storage host rather than the API. Without this origin in `connect-src` the browser
 * refuses the upload before it leaves the page, and without it in `img-src` a stored
 * photo cannot be rendered. `STORAGE_PUBLIC_ENDPOINT` is the same value the API signs
 * its URLs with, so the two can never point at different hosts.
 */
const storageOrigin = (): string | null => {
  const raw = process.env.STORAGE_PUBLIC_ENDPOINT ?? 'http://localhost:9000';
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const buildPolicy = (nonce: string): string => {
  const storage = storageOrigin();
  const media = storage === null ? '' : ` ${storage}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Next injects inline styles for critical CSS; styles cannot be nonced
    // reliably, so this stays permissive while scripts do not.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${media}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin()}${media}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
};

export function middleware(request: NextRequest): NextResponse {
  // 128 bits of entropy, base64 encoded as CSP requires.
  const nonce = btoa(crypto.randomUUID());
  const policy = buildPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', policy);

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image optimisation output. Excluding
     * them keeps the nonce from invalidating long-lived immutable files, which
     * are safe because they carry no executable content.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
