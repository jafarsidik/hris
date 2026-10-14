import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ForbiddenError } from '../errors/app-error';
import { REQUIRE_PERMISSION_KEY, type PermissionRequirement } from './require-permission.decorator';
import { type AuthenticatedRequest } from './request-auth';
import { PermissionService, type SessionPrincipal } from './permission.service';

/**
 * Enforces a route's declared permission requirement.
 *
 * A `manage` grant implies every other action on the resource, so a System
 * Administrator who holds `permission.manage` may read, create, update and delete
 * roles without a separate grant per action. Everything is resolved from the live
 * database on this request.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { auth?: AuthenticatedRequest; authPrincipal?: SessionPrincipal }>();

    if (!request.auth) {
      // The AuthenticationGuard always runs first (APP_GUARD ordering), so this state
      // is unreachable; the guard stands alone anyway to stay defensive.
      throw new ForbiddenError('Authentication is required for this action');
    }

    const principal =
      request.authPrincipal ??
      (await this.permissions.loadPrincipal(request.auth.userId, request.auth.companyId));
    request.authPrincipal = principal;

    if (!can(principal.permissions, requirement.resource, requirement.action)) {
      throw new ForbiddenError(
        `You do not have the "${requirement.action}" permission on "${requirement.resource}".`,
      );
    }

    return true;
  }
}

export function can(
  permissions: readonly { resource: string; action: string }[],
  resource: string,
  action: string,
): boolean {
  return permissions.some(
    (permission) =>
      permission.resource === resource &&
      (permission.action === action || permission.action === 'manage'),
  );
}

export function canViewSensitive(
  permissions: readonly { resource: string; action: string }[],
  resource: string,
): boolean {
  return permissions.some(
    (permission) =>
      permission.resource === resource &&
      (permission.action === 'view_sensitive' || permission.action === 'manage'),
  );
}
