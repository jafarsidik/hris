/**
 * Seeds the platform metadata registry from the existing vocabulary.
 *
 * The registry is data, so it is bootstrapped from the constants the rest of the
 * platform already compiles against: `ACTIONS`, `RESOURCES` and `MODULE_IDS`. A
 * resource or action missing from `RESOURCES`/`ACTIONS` is not registered, which keeps
 * the registry an accurate mirror of what the RBAC layer actually authorises.
 *
 * Every write is an idempotent upsert keyed on a natural key, so the seed can run on
 * every deploy of an environment that already has rows.
 */
import { ACTIONS, MODULE_IDS, RESOURCES } from '@hris/shared-types';

import type { PrismaClient } from '../src/generated/prisma/client';

import { MODULE_LABELS, RESOURCE_CATALOG, RESOURCE_FIELDS } from './registry-catalog';

/** The key of the platform application the HRIS registers itself as. */
export const PLATFORM_APPLICATION_KEY = 'HRIS';

export interface RegistrySeedResult {
  readonly applications: number;
  readonly modules: number;
  readonly resources: number;
  readonly fields: number;
  readonly actions: number;
}

/** Human label for a hyphenated key such as `industrial-relation` or `audit-log`. */
export function humanizeKey(key: string): string {
  return key
    .split('-')
    .map((word) => (word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`))
    .join(' ');
}

/**
 * Registers the platform application, its modules, resources, fields and actions.
 *
 * The registry reads the shared vocabulary but does not depend on the seeded
 * `permissions` rows, so its position relative to `seedRbac` does not matter.
 */
export async function seedRegistry(client: PrismaClient): Promise<{
  applications: number;
  modules: number;
  resources: number;
  fields: number;
  actions: number;
}> {
  const application = await client.application.upsert({
    where: { key: PLATFORM_APPLICATION_KEY },
    update: { name: 'HRIS Platform' },
    create: {
      key: PLATFORM_APPLICATION_KEY,
      name: 'HRIS Platform',
      description: 'The enterprise HRIS built on the platform.',
    },
  });

  const moduleIdsByModule = new Map<string, string>();
  let modules = 0;

  for (const [index, moduleId] of MODULE_IDS.entries()) {
    const label = MODULE_LABELS[moduleId];
    const row = await client.appModule.upsert({
      where: { key: moduleId },
      update: {
        name: label.name,
        description: label.description,
        moduleId,
        sortOrder: index,
        isActive: true,
      },
      create: {
        applicationId: application.id,
        key: moduleId,
        name: label.name,
        description: label.description,
        moduleId,
        sortOrder: index,
      },
    });
    moduleIdsByModule.set(moduleId, row.id);
    modules += 1;
  }

  let resources = 0;
  let fields = 0;
  let actions = 0;

  for (const resource of RESOURCES) {
    const spec = RESOURCE_CATALOG[resource];
    const name = spec.name ?? humanizeKey(resource);
    const moduleRowId = moduleIdsByModule.get(spec.module) ?? null;

    const row = await client.resourceDefinition.upsert({
      where: { key: resource },
      update: {
        name,
        moduleId: moduleRowId,
        resourceType: spec.type,
        supportsCrud: spec.crud ?? false,
        isActive: true,
      },
      create: {
        applicationId: application.id,
        moduleId: moduleRowId,
        key: resource,
        name,
        resourceType: spec.type,
        supportsCrud: spec.crud ?? false,
      },
    });
    resources += 1;

    for (const [index, field] of (RESOURCE_FIELDS[resource] ?? []).entries()) {
      await client.resourceField.upsert({
        where: { resourceId_key: { resourceId: row.id, key: field.key } },
        update: {
          label: field.label,
          dataType: field.dataType,
          required: field.required ?? false,
          isSensitive: field.isSensitive ?? false,
          sortOrder: index,
        },
        create: {
          resourceId: row.id,
          key: field.key,
          label: field.label,
          dataType: field.dataType,
          required: field.required ?? false,
          isSensitive: field.isSensitive ?? false,
          sortOrder: index,
        },
      });
      fields += 1;
    }

    for (const action of ACTIONS) {
      await client.registeredAction.upsert({
        where: { resourceId_action: { resourceId: row.id, action } },
        update: { name: humanizeKey(action) },
        create: { resourceId: row.id, action, name: humanizeKey(action), isCustom: false },
      });
      actions += 1;
    }
  }

  return { applications: 1, modules, resources, fields, actions };
}
