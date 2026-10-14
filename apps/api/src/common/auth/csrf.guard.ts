import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import type { AppConfiguration } from '../../config/app-configuration';
import { APP_CONFIG } from '../../config/app-configuration.module';
import { ForbiddenError } from '../errors/app-error';
import { extractSessionToken } from './request-auth';

/**
 * Rejects cross-site state-changing requests made with a cookie-authenticated
 * session.
 *
 * The session cookie is `SameSite=Strict`, which already blocks nearly all CSRF.
 * This guard is the second, independent layer for the risky remainder (Safari-era
 * same-site confusion, uninvited subdomain frames): a non-safe request carrying the
 * session cookie must also carry the `X-Requested-With` header, which JavaScript can
 * set but a cross-site form cannot. Requests authenticated by `Authorization: Bearer`
 * (no cookie) are not at risk and are unaffected.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // Only cookie-authenticated requests carry the CSRF risk. A bearer token is
    // supplied by the caller itself and cannot be force-injected cross-site.
    const cookieToken = extractSessionToken(request, this.config.auth.cookieName);
    const usesCookie = cookieToken?.transport === 'cookie';
    if (!usesCookie) {
      return true;
    }

    if (request.headers['x-requested-with'] === undefined) {
      throw new ForbiddenError(
        'This request must include the X-Requested-With header to confirm it is same-origin.',
      );
    }

    return true;
  }
}
