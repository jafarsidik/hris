import { DATA_SCOPE_RANK, type DataScope, type EffectivePermission } from '@hris/shared-types';

/**
 * The record-level decision for one resource/action, derived from the caller's widest
 * scope. `all` means every record visible through the tenant context; `self` narrows to
 * the caller's own row; `subtree`/`entity` narrow to an organizational subtree or legal
 * entity; `denied` is the default-deny outcome for a scope the platform cannot resolve.
 */
export type ScopeDecision =
  | { readonly kind: 'all' }
  | { readonly kind: 'self'; readonly userId: string }
  | { readonly kind: 'subtree'; readonly rootUnitId: string }
  | { readonly kind: 'entity'; readonly rootUnitId: string }
  | { readonly kind: 'denied'; readonly scope: DataScope | null };

/** The caller attributes a scope resolution needs, drawn from the session principal. */
export interface ScopeCaller {
  readonly userId: string;
  readonly unitId: string | null;
}

/**
 * The widest grant the caller holds for `resource.action`, including any `scopeId` that
 * pins it to a specific organizational unit. `manage` implies every other action,
 * mirroring the authorisation guard. On a tie the grant without a `scopeId` wins,
 * because an unscoped grant is the broader of the two.
 */
export function effectiveGrant(
  permissions: readonly EffectivePermission[],
  resource: string,
  action: string,
): { readonly scope: DataScope; readonly scopeId: string | null } | null {
  let best: { scope: DataScope; scopeId: string | null } | null = null;
  for (const permission of permissions) {
    if (permission.resource !== resource) {
      continue;
    }
    if (permission.action !== action && permission.action !== 'manage') {
      continue;
    }
    const scope = permission.scope as DataScope;
    const scopeId = permission.scopeId ?? null;
    if (best === null || DATA_SCOPE_RANK[scope] > DATA_SCOPE_RANK[best.scope]) {
      best = { scope, scopeId };
    } else if (
      DATA_SCOPE_RANK[scope] === DATA_SCOPE_RANK[best.scope] &&
      best.scopeId !== null &&
      scopeId === null
    ) {
      best = { scope, scopeId };
    }
  }
  return best;
}

/**
 * The widest scope the caller holds for `resource.action`, or `null` when they hold no
 * such grant. `manage` implies every other action, mirroring the authorisation guard.
 */
export function effectiveScope(
  permissions: readonly EffectivePermission[],
  resource: string,
  action: string,
): DataScope | null {
  return effectiveGrant(permissions, resource, action)?.scope ?? null;
}

/** The unit that anchors an org-level scope: an explicit grant narrowing, else the caller. */
function scopeRoot(
  grantScopeId: string | null | undefined,
  callerUnitId: string | null,
): string | null {
  return grantScopeId ?? callerUnitId;
}

/**
 * Resolves the caller's widest grant for a resource/action into a query constraint.
 *
 * `GLOBAL` and `COMPANY` both mean "every record the tenant context exposes": the
 * company boundary is already enforced by row-level security and `withTenantContext`,
 * so `COMPANY` does not add a further predicate. `SELF` narrows to the caller's own row.
 * `TEAM`/`DEPARTMENT` narrow to the organizational subtree rooted at the grant's
 * `scopeId` (or the caller's own unit); `ENTITY` narrows to that unit's legal entity.
 * An org scope with neither a grant narrowing nor a caller placement default-denies
 * rather than silently widening access.
 */
export function resolveScope(
  permissions: readonly EffectivePermission[],
  resource: string,
  action: string,
  caller: { readonly userId: string; readonly unitId: string | null },
): ScopeDecision {
  const grant = effectiveGrant(permissions, resource, action);
  if (!grant) {
    return { kind: 'denied', scope: null };
  }

  switch (grant.scope) {
    case 'GLOBAL':
    case 'COMPANY':
      return { kind: 'all' };
    case 'SELF':
      return { kind: 'self', userId: caller.userId };
    case 'TEAM':
    case 'DEPARTMENT': {
      const root = scopeRoot(grant.scopeId, caller.unitId);
      return root ? { kind: 'subtree', rootUnitId: root } : { kind: 'denied', scope: grant.scope };
    }
    case 'ENTITY': {
      const root = scopeRoot(grant.scopeId, caller.unitId);
      return root ? { kind: 'entity', rootUnitId: root } : { kind: 'denied', scope: grant.scope };
    }
    default:
      return { kind: 'denied', scope: grant.scope };
  }
}

/**
 * Whether the caller may hand out `grant`. A caller can only grant a capability they
 * already hold: the resource and action must match (with `manage` implying every action)
 * and the caller's own scope must be at least as wide as the one being granted. This is
 * what stops a delegated administrator from minting authority they do not possess.
 */
export function canGrant(
  permissions: readonly EffectivePermission[],
  grant: { readonly resource: string; readonly action: string; readonly scope: DataScope },
): boolean {
  return permissions.some(
    (permission) =>
      permission.resource === grant.resource &&
      (permission.action === grant.action || permission.action === 'manage') &&
      DATA_SCOPE_RANK[permission.scope as DataScope] >= DATA_SCOPE_RANK[grant.scope],
  );
}
