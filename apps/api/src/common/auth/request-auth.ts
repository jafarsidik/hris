import type { Request } from 'express';

import { API_KEY_PREFIX } from './api-key';
import type { SessionPrincipal } from './permission.service';

/**
 * Identifies the authenticated caller on a request.
 *
 * Attached by `AuthenticationGuard` after the presented token has been resolved
 * through the Redis session store (ADR 0010). The token itself and its hash never
 * leave the server; the controller sees only ids.
 */
export interface AuthenticatedRequest {
  readonly userId: string;
  readonly companyId: string;
  readonly sessionId: string;
  readonly tokenHash: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present on every authenticated request below the AuthenticationGuard. */
      auth?: AuthenticatedRequest;
      /** Present once the principal has been loaded by the AuthenticationGuard. */
      authPrincipal?: SessionPrincipal;
      /**
       * The developer API client that authenticated this request, if any. Set before the
       * rate limit is enforced so a throttled request is still attributed to its client;
       * absent for an ordinary session. The request-usage writer reads it after the
       * response is sent.
       */
      apiClientId?: string;
      /** The tenant of {@link apiClientId}, for usage rows written outside the auth path. */
      apiClientCompanyId?: string;
    }
  }
}

/**
 * Reads the opaque session token from a cookie or an Authorization: Bearer header.
 *
 * The cookie is the primary transport (ADR 0010); the header exists so automated
 * clients and the Swagger UI can authenticate without a cookie jar. Both carry the
 * identical opaque token, so neither path avoids the redis lookup.
 */
export function extractSessionToken(
  request: Request,
  cookieName: string,
): { token: string; transport: 'cookie' | 'bearer' } | null {
  const header = request.headers.authorization;
  if (header !== undefined) {
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return { token, transport: 'bearer' };
    }
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader !== undefined) {
    const token = parseCookie(cookieHeader, cookieName);
    if (token) {
      return { token, transport: 'cookie' };
    }
  }

  return null;
}

/**
 * Reads a developer API key from `X-Api-Key` or an `Authorization: Bearer` header.
 *
 * The prefix check is what keeps an API key from ever being routed down the session
 * path: a key always starts with `hris_ak_`, an opaque session token never does.
 */
export function extractApiKey(request: Request): string | null {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  const authorization = request.headers.authorization;
  if (authorization !== undefined) {
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token?.startsWith(API_KEY_PREFIX)) {
      return token;
    }
  }

  return null;
}

function parseCookie(header: string, name: string): string | null {
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key === name && value.length > 0) {
      return decodeURIComponent(value);
    }
  }
  return null;
}
