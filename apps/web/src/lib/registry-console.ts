import type { EffectivePermission, ResourceSummary } from '@hris/shared-types';

import { holdsPermission, type ConsoleItem } from './console';

/**
 * Derives console entries from the live platform registry.
 *
 * The curated console (`CONSOLE_SECTIONS`) is code; a resource registered at runtime is
 * data. This bridges the two: every active, CRUD-enabled resource the caller may `view`
 * becomes a console item, so an administrator who registers a resource sees it without a
 * web deploy. Authorization is unchanged — the derived item is only shown when the caller
 * holds the resource's `view` permission, and the records API re-checks on every request.
 *
 * The link targets the Resource Registry filtered to the resource, which always exists;
 * a resource with no bespoke screen is still inspectable (its fields and actions) rather
 * than linking to a route that would 404.
 */
export function registryConsoleItems(
  resources: readonly ResourceSummary[],
  permissions: readonly EffectivePermission[],
): readonly ConsoleItem[] {
  return resources
    .filter(
      (resource) =>
        resource.isActive &&
        resource.supportsCrud &&
        holdsPermission(permissions, `${resource.key}.view`),
    )
    .map((resource) => ({
      label: resource.name,
      description: resource.description ?? `${resource.key} · registered resource`,
      href: `/setup/registry?resource=${encodeURIComponent(resource.key)}`,
      status: 'built' as const,
      permission: `${resource.key}.view` as ConsoleItem['permission'],
    }));
}
