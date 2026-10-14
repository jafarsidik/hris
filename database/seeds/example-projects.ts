/**
 * Seeds the example domain application "Projects" (Phase 5b).
 *
 * This is the whole cost of adding a domain to the platform: metadata. The application,
 * module, resources, fields and actions are written here — not to the shared `RESOURCES`
 * /`ACTIONS` bootstrap constants and not to any core module. `seedRbac` then generates
 * the `project.*`/`task.*` permissions from these registry rows, so an administrator can
 * grant them like any other resource.
 *
 * Idempotent: every write is an upsert keyed on the natural key, so it is safe on every
 * deploy of an environment that already has the rows.
 */
import { ACTIONS } from '@hris/shared-types';

import type { PrismaClient } from '../src/generated/prisma/client';
import type { FieldDataType } from '@hris/shared-types';

import { humanizeKey } from './registry';

/** The application key. Distinct from the platform application (`HRIS`). */
export const EXAMPLE_APPLICATION_KEY = 'PROJECTS';

/** The module key inside the example application. */
export const EXAMPLE_MODULE_KEY = 'PROJECT_MANAGEMENT';

interface ExampleField {
  readonly key: string;
  readonly label: string;
  readonly dataType: FieldDataType;
  readonly required?: boolean;
  readonly isSensitive?: boolean;
}

interface ExampleResource {
  readonly name: string;
  readonly fields: readonly ExampleField[];
  readonly customActions?: readonly string[];
}

const EXAMPLE_RESOURCES: Readonly<Record<string, ExampleResource>> = {
  project: {
    name: 'Project',
    fields: [
      { key: 'name', label: 'Name', dataType: 'STRING', required: true },
      { key: 'description', label: 'Description', dataType: 'STRING' },
      { key: 'status', label: 'Status', dataType: 'STRING' },
      { key: 'startDate', label: 'Start date', dataType: 'DATE' },
      { key: 'dueDate', label: 'Due date', dataType: 'DATE' },
    ],
  },
  task: {
    name: 'Task',
    fields: [
      { key: 'title', label: 'Title', dataType: 'STRING', required: true },
      { key: 'status', label: 'Status', dataType: 'STRING' },
      { key: 'projectId', label: 'Project', dataType: 'REFERENCE' },
      { key: 'assigneeId', label: 'Assignee', dataType: 'REFERENCE' },
      { key: 'dueDate', label: 'Due date', dataType: 'DATE' },
      { key: 'completedAt', label: 'Completed at', dataType: 'DATETIME' },
    ],
    // A custom action: registered metadata, authorised through the standard
    // `task.update` permission by the handler. It is not a member of the `Action` enum.
    customActions: ['complete'],
  },
};

export interface ExampleProjectsSeedResult {
  readonly applications: number;
  readonly modules: number;
  readonly resources: number;
  readonly fields: number;
  readonly actions: number;
}

export async function seedExampleProjects(
  client: PrismaClient,
): Promise<ExampleProjectsSeedResult> {
  const application = await client.application.upsert({
    where: { key: EXAMPLE_APPLICATION_KEY },
    update: {
      name: 'Projects',
      description: 'Example domain application registered entirely through metadata.',
    },
    create: {
      key: EXAMPLE_APPLICATION_KEY,
      name: 'Projects',
      description: 'Example domain application registered entirely through metadata.',
    },
  });

  const module = await client.appModule.upsert({
    where: { key: EXAMPLE_MODULE_KEY },
    update: {
      name: 'Project Management',
      description: 'Projects and tasks.',
      applicationId: application.id,
    },
    create: {
      applicationId: application.id,
      key: EXAMPLE_MODULE_KEY,
      name: 'Project Management',
      description: 'Projects and tasks.',
      sortOrder: 100,
    },
  });

  let resources = 0;
  let fields = 0;
  let actions = 0;

  for (const [key, spec] of Object.entries(EXAMPLE_RESOURCES)) {
    const resource = await client.resourceDefinition.upsert({
      where: { key },
      update: {
        name: spec.name,
        applicationId: application.id,
        moduleId: module.id,
        resourceType: 'TRANSACTION',
        supportsCrud: true,
        isActive: true,
      },
      create: {
        applicationId: application.id,
        moduleId: module.id,
        key,
        name: spec.name,
        resourceType: 'TRANSACTION',
        supportsCrud: true,
      },
    });
    resources += 1;

    for (const [index, field] of spec.fields.entries()) {
      await client.resourceField.upsert({
        where: { resourceId_key: { resourceId: resource.id, key: field.key } },
        update: {
          label: field.label,
          dataType: field.dataType,
          required: field.required ?? false,
          isSensitive: field.isSensitive ?? false,
          sortOrder: index,
        },
        create: {
          resourceId: resource.id,
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
        where: { resourceId_action: { resourceId: resource.id, action } },
        update: { name: humanizeKey(action), isCustom: false },
        create: {
          resourceId: resource.id,
          action,
          name: humanizeKey(action),
          isCustom: false,
        },
      });
      actions += 1;
    }

    for (const custom of spec.customActions ?? []) {
      await client.registeredAction.upsert({
        where: { resourceId_action: { resourceId: resource.id, action: custom } },
        update: { name: humanizeKey(custom), isCustom: true },
        create: {
          resourceId: resource.id,
          action: custom,
          name: humanizeKey(custom),
          isCustom: true,
        },
      });
      actions += 1;
    }
  }

  return { applications: 1, modules: 1, resources, fields, actions };
}
