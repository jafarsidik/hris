import { SetMetadata } from '@nestjs/common';

import type { Action } from '@hris/shared-types';

/** Metadata key the AuthorizationGuard reads. */
export const REQUIRE_PERMISSION_KEY = 'hris:require-permission';

/**
 * The capability a route requires. `manage` always implies the other actions on the
 * same resource, which the guard enforces when resolving the effective permissions.
 */
export interface PermissionRequirement {
  readonly resource: string;
  readonly action: Action;
}

/**
 * Declares the `resource.action` a route needs.
 *
 * The guard compares this against the caller's effective permissions resolved from
 * the database on this request; it does not trust anything embedded in a token.
 */
export const RequirePermission = (
  resource: string,
  action: Action,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { resource, action } satisfies PermissionRequirement);
