import { ACTIONS, type DataScope, type ResourceSummary } from '@hris/shared-types';

import type { PermissionGrantInput } from './iam-types';

/**
 * Pure helpers for the registry-backed permission matrix.
 *
 * The matrix is `resource × action × scope`, sourced from the platform registry
 * (`ResourceDefinition` + `RegisteredAction`) rather than a hardcoded frontend table.
 * These functions hold no React or network state so the selection rules — toggle,
 * re-scope, serialise — can be tested directly.
 */

/** The scope a freshly enabled cell receives before the operator narrows it. */
export const DEFAULT_SCOPE: DataScope = 'COMPANY';

/** One action column cell, identified by its `resource:action` grant key. */
export interface MatrixAction {
  readonly action: string;
  readonly name: string;
  readonly isCustom: boolean;
  readonly grantKey: string;
}

/** One resource row: the actions it supports. */
export interface MatrixResource {
  readonly key: string;
  readonly name: string;
  readonly moduleKey: string | null;
  readonly resourceType: ResourceSummary['resourceType'];
  readonly supportsCrud: boolean;
  readonly actions: readonly MatrixAction[];
}

/** A module's worth of resources, with the union of their actions as column headers. */
export interface MatrixGroup {
  readonly key: string | null;
  readonly name: string;
  readonly columns: readonly string[];
  readonly resources: readonly MatrixResource[];
}

/** Stable identity of a single grant. */
export function grantKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

const actionRank = (action: string): number => {
  const index = (ACTIONS as readonly string[]).indexOf(action);
  return index === -1 ? ACTIONS.length : index;
};

const compareActions = (a: string, b: string): number =>
  actionRank(a) - actionRank(b) || a.localeCompare(b);

/** Orders and projects registry resources into matrix rows. */
export function toMatrixResources(
  resources: readonly ResourceSummary[],
): readonly MatrixResource[] {
  return [...resources]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((resource) => ({
      key: resource.key,
      name: resource.name,
      moduleKey: resource.moduleKey,
      resourceType: resource.resourceType,
      supportsCrud: resource.supportsCrud,
      actions: [...resource.actions]
        .sort((a, b) => compareActions(a.action, b.action))
        .map((action) => ({
          action: action.action,
          name: action.name,
          isCustom: action.isCustom,
          grantKey: grantKey(resource.key, action.action),
        })),
    }));
}

/**
 * Groups matrix rows by their owning module, in the module's declared order.
 * Resources with no module land in a trailing "Unassigned" group.
 */
export function groupMatrixByModule(
  resources: readonly MatrixResource[],
  modules: readonly { readonly key: string; readonly name: string }[],
): readonly MatrixGroup[] {
  const moduleKeys = new Map<string, string | null>();
  const moduleName = new Map<string, string>();
  const order = new Map<string, number>();

  resources.forEach((resource) => {
    const module = modules.find((candidate) => candidate.key === resource.moduleKey);
    moduleKeys.set(resource.key, module?.key ?? null);
    if (module) {
      moduleName.set(module.key, module.name);
      order.set(
        module.key,
        modules.findIndex((candidate) => candidate.key === module.key),
      );
    }
  });

  const buckets = new Map<string | null, MatrixResource[]>();
  resources.forEach((resource) => {
    const key = moduleKeys.get(resource.key) ?? null;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(resource);
    } else {
      buckets.set(key, [resource]);
    }
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .map(([key, groupResources]) => {
      const columns = [...new Set(groupResources.flatMap((r) => r.actions.map((a) => a.action)))];
      return {
        key,
        name: key === null ? 'Unassigned' : (moduleName.get(key) ?? key),
        columns: columns.sort(compareActions),
        resources: groupResources,
      };
    });
}

/** Indexes a grant list by `resource:action`, last write winning. */
export function grantsToMap(
  grants: readonly PermissionGrantInput[],
): Map<string, PermissionGrantInput> {
  const map = new Map<string, PermissionGrantInput>();
  grants.forEach((grant) => map.set(grantKey(grant.resource, grant.action), grant));
  return map;
}

/** Whether a cell is enabled. */
export function hasGrant(
  grants: ReadonlyMap<string, PermissionGrantInput>,
  resource: string,
  action: string,
): boolean {
  return grants.has(grantKey(resource, action));
}

/** The scope a cell currently carries, or null when the cell is disabled. */
export function scopeFor(
  grants: ReadonlyMap<string, PermissionGrantInput>,
  resource: string,
  action: string,
): DataScope | null {
  return grants.get(grantKey(resource, action))?.scope ?? null;
}

/** Enables a disabled cell (with the default scope) or disables an enabled one. */
export function toggleGrant(
  grants: ReadonlyMap<string, PermissionGrantInput>,
  resource: string,
  action: string,
  defaultScope: DataScope = DEFAULT_SCOPE,
): Map<string, PermissionGrantInput> {
  const next = new Map(grants);
  const key = grantKey(resource, action);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.set(key, { resource, action, scope: defaultScope });
  }
  return next;
}

/** Re-scopes an enabled cell; a disabled cell is left untouched. */
export function setGrantScope(
  grants: ReadonlyMap<string, PermissionGrantInput>,
  resource: string,
  action: string,
  scope: DataScope,
): Map<string, PermissionGrantInput> {
  const key = grantKey(resource, action);
  const existing = grants.get(key);
  if (!existing) {
    return new Map(grants);
  }
  const next = new Map(grants);
  next.set(key, { ...existing, scope });
  return next;
}

/** Serialises the selection back to the API payload, ordered for stable diffs. */
export function mapToGrants(
  grants: ReadonlyMap<string, PermissionGrantInput>,
): readonly PermissionGrantInput[] {
  return [...grants.values()].sort(
    (a, b) =>
      a.resource.localeCompare(b.resource) ||
      actionRank(a.action) - actionRank(b.action) ||
      a.action.localeCompare(b.action),
  );
}
