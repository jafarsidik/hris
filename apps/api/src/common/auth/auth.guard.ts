import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AppConfiguration } from '../../config/app-configuration';
import { APP_CONFIG } from '../../config/app-configuration.module';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ForbiddenError, RateLimitedError, UnauthenticatedError } from '../errors/app-error';
import { RateLimiter } from '../rate-limit/rate-limiter.service';
import { PrismaService } from '../../modules/database/prisma.service';
import { ApiClientAuthenticator } from './api-client-authenticator.service';
import { PasswordService } from './password.service';
import { PermissionService, type SessionPrincipal } from './permission.service';
import type { AuthenticatedRequest } from './request-auth';
import { extractApiKey, extractSessionToken } from './request-auth';
import { SESSION_STORE, type SessionStore } from './session.store';

/**
 * Authenticates every request except those marked `@Public()`.
 *
 * ADR 0010 pipeline: hash the presented token, look it up in Redis (a miss is an
 * unauthenticated request, full stop), then confirm against the live user row that
 * the account still exists and is active. Nothing about the caller is trusted from
 * the token itself.
 *
 * The principal (user, roles, effective permissions) is resolved here on every
 * authenticated request, so a role change is visible on the very next call and the
 * AuthorizationGuard never re-fetches it.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(ApiClientAuthenticator) private readonly apiClients: ApiClientAuthenticator,
    @Inject(RateLimiter) private readonly rateLimiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { auth?: AuthenticatedRequest; authPrincipal?: SessionPrincipal }>();

    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    // A developer API key is resolved through its own cross-tenant lookup; it never
    // touches the session store and produces a synthetic client principal.
    const apiKey = extractApiKey(request);
    if (apiKey !== null) {
      const resolved = await this.apiClients.authenticate(apiKey);
      if (resolved === null) {
        throw new UnauthenticatedError('The API key is invalid or revoked');
      }
      await this.enforceApiClientRateLimit(resolved.principal.user.id);
      request.auth = {
        userId: resolved.principal.user.id,
        companyId: resolved.principal.user.companyId,
        sessionId: `api-client:${resolved.principal.user.id}`,
        tokenHash: resolved.tokenHash,
      };
      request.authPrincipal = resolved.principal;
      return true;
    }
    const presented = extractSessionToken(request, this.config.auth.cookieName);
    if (presented === null) {
      throw new UnauthenticatedError('Authentication is required');
    }

    const tokenHash = this.passwordService.sha256Hex(presented.token);
    const stored = await this.sessionStore.read(tokenHash);
    if (!stored) {
      throw new UnauthenticatedError('Your session is no longer valid. Please sign in again.');
    }

    const principal = await this.permissions.loadPrincipal(stored.userId, stored.companyId);

    if (principal.user.status !== 'ACTIVE') {
      throw new ForbiddenError('Your account is not active. Please contact your administrator.');
    }

    request.auth = {
      userId: stored.userId,
      companyId: stored.companyId,
      sessionId: stored.sessionId,
      tokenHash,
    };
    request.authPrincipal = principal;

    return true;
  }

  /**
   * Bounds a machine principal's request rate. A developer API client carries no
   * human-attention limit, so without a ceiling a single key could exhaust the tenant's
   * capacity; the counter is keyed on the client id and fails closed on the next request
   * once the window is spent.
   */
  private async enforceApiClientRateLimit(clientId: string): Promise<void> {
    const limit = this.config.rateLimit.apiRequestsPerMinute;
    if (limit <= 0) {
      return;
    }
    const result = await this.rateLimiter.consume(`hris:rl:apiclient:${clientId}`, limit, 60);
    if (!result.allowed) {
      throw new RateLimitedError(
        'The API client has exceeded its request quota. Please retry later.',
        result.retryAfterSeconds,
      );
    }
  }
}
