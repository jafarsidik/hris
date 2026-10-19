/**
 * Seed for the RBAC vocabulary: roles, permissions, and the grants that connect them.
 *
 * Every write is an `upsert` keyed on the natural key, so running the seed repeatedly
 * converges on the same rows instead of failing on a unique constraint. That matters
 * because the seed runs on every deploy of an environment that already has data.
 */
import { ACTIONS, SYSTEM_ROLES } from '@hris/shared-types';

import type { PrismaClient } from '../src/generated/prisma/client';

type Action = (typeof ACTIONS)[number];

function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

/**
 * Builds the `resource.action` permission rows from the registry.
 *
 * The registry (`resource_definitions` × `registered_actions`) is the source of truth
 * for what can be authorised; the shared `RESOURCES`/`ACTIONS` constants are only the
 * bootstrap seed that `seedRegistry` reads. Generating permissions from the registry
 * means a resource or action registered at runtime becomes grantable after the next
 * seed, with no core change.
 *
 * Only actions in the `Action` enum become permission rows: the `permissions.action`
 * column is that enum, while a registered action is a free string (so a custom action
 * such as `approve` is registered but is not a standalone grantable permission yet).
 */
export async function buildPermissionRowsFromRegistry(client: PrismaClient): Promise<
  {
    key: string;
    resource: string;
    action: Action;
  }[]
> {
  const resources = await client.resourceDefinition.findMany({
    where: { isActive: true },
    orderBy: { key: 'asc' },
    select: { key: true, registeredActions: { select: { action: true } } },
  });

  const rows: { key: string; resource: string; action: Action }[] = [];
  for (const resource of resources) {
    const seen = new Set<Action>();
    for (const { action } of resource.registeredActions) {
      if (isAction(action) && !seen.has(action)) {
        seen.add(action);
        rows.push({ key: `${resource.key}.${action}`, resource: resource.key, action });
      }
    }
  }

  return rows;
}

/**
 * Seeds countries and currencies.
 *
 * Only `name` is updated on conflict. `minorUnit` is deliberately left alone for the
 * same reason: an operator who has corrected it locally should not have that silently
 * reverted by a deploy, since the correction was almost certainly deliberate.
 */
export async function seedReferenceData(client: PrismaClient): Promise<{
  countries: number;
  currencies: number;
}> {
  const { COUNTRY_NAMES, COUNTRY_CURRENCIES } = await import('./reference-data');

  const { COUNTRY_CODES } = await import('@hris/shared-types');

  let countries = 0;
  for (const code of COUNTRY_CODES) {
    const name = COUNTRY_NAMES[code];

    if (name === undefined) {
      throw new Error(
        `COUNTRY_CODES contains "${code}" but COUNTRY_NAMES has no name for it. ` +
          'Add the name to database/seeds/reference-data.ts.',
      );
    }

    await client.country.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
    countries += 1;
  }

  let currencies = 0;
  for (const currency of COUNTRY_CURRENCIES) {
    await client.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name },
      create: { code: currency.code, name: currency.name, minorUnit: currency.minorUnit },
    });
    currencies += 1;
  }

  return { countries, currencies };
}

/**
 * Seeds system roles and the permission vocabulary.
 *
 * `isSystem` is not reset on update: a role that an operator has converted into a
 * custom role should not silently be restored to system status by the next deploy.
 */
export async function seedRbac(client: PrismaClient): Promise<{
  roles: number;
  permissions: number;
  grants: number;
}> {
  let roles = 0;
  for (const role of SYSTEM_ROLES) {
    await client.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });
    roles += 1;
  }

  const permissionRows = await buildPermissionRowsFromRegistry(client);

  for (const permission of permissionRows) {
    await client.permission.upsert({
      where: { key: permission.key },
      update: { resource: permission.resource, action: permission.action },
      create: permission,
    });
  }

  // Only the system administrator is granted permissions here.
  //
  // Its shared-types description is "unrestricted platform configuration and access
  // administration", which maps exactly onto every permission at GLOBAL scope. The other
  // ten roles are seeded without grants on purpose: their permissions depend on the
  // behaviour of modules M01-M09, none of which exist yet. Assigning a guessed matrix
  // now would encode assumptions about those modules as though they were requirements,
  // and the grants would then be inherited by every environment silently.
  const adminRole = await client.role.findUniqueOrThrow({ where: { key: 'SYSTEM_ADMIN' } });

  let grants = 0;
  for (const permission of permissionRows) {
    const row = await client.permission.findUniqueOrThrow({
      where: { key: permission.key },
      select: { id: true },
    });

    await client.rolePermission.upsert({
      where: {
        roleId_permissionId_dataScope: {
          roleId: adminRole.id,
          permissionId: row.id,
          dataScope: 'GLOBAL',
        },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: row.id, dataScope: 'GLOBAL' },
    });
    grants += 1;
  }

  return { roles, permissions: permissionRows.length, grants };
}
