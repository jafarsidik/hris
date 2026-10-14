import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { type AuthenticatedRequest } from './request-auth';
import { type SessionPrincipal } from './permission.service';

interface AuthRequest extends Request {
  auth?: AuthenticatedRequest;
  authPrincipal?: SessionPrincipal;
}

/**
 * Injects the AuthenticatedRequest (caller ids + session id) attached by the
 * AuthenticationGuard.
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequest => {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.auth) {
      throw new Error('CurrentAuth is only available on authenticated routes');
    }
    return request.auth;
  },
);

/**
 * Injects the full principal (user, roles, effective permissions) for the caller.
 *
 * Attached by the AuthenticationGuard, which resolves it from the database on every
 * authenticated request so a role change is visible on the very next call (ADR 0010).
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPrincipal => {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.authPrincipal) {
      throw new Error('CurrentPrincipal is only available on authenticated routes');
    }
    return request.authPrincipal;
  },
);
