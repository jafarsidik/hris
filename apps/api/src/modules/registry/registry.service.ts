import { Inject, Injectable } from '@nestjs/common';

import type {
  ApplicationSummary,
  CreateApplicationInput,
  CreateModuleInput,
  CreateRegisteredActionInput,
  CreateResourceFieldInput,
  CreateResourceInput,
  ModuleSummary,
  ResourceSummary,
  UpdateApplicationInput,
  UpdateModuleInput,
  UpdateResourceInput,
} from '@hris/shared-types';

import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

/** Identifies the caller for provenance and audit. */
export interface RegistryActor {
  readonly companyId: string;
  readonly userId: string;
}

const SLUG = /^[a-z][a-z0-9-]*$/;
const MODULE_KEY = /^[A-Z][A-Z0-9_]*$/;
const ACTION_KEY = /^[a-z][a-z0-9_]*$/;

/**
 * Reads and writes the platform metadata registry.
 *
 * The registry tables are platform-wide (no tenant column, no row-level security), so
 * unlike the tenant-scoped modules this service reads without `withTenantContext`.
 * Access is gated by `registry:*` at the controller. Writes still record an audit row
 * inside the actor's tenant context, so every registration is attributable and
 * tamper-evident.
 */
@Injectable()
export class RegistryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ------------------------------------------------------------------ reads

  async listApplications(): Promise<ApplicationSummary[]> {
    const rows = await this.prisma.getClient().application.findMany({
      orderBy: { key: 'asc' },
    });

    return rows.map((row) => this.toApplicationSummary(row));
  }

  async listModules(): Promise<ModuleSummary[]> {
    const rows = await this.prisma.getClient().appModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });

    return rows.map((row) => this.toModuleSummary(row));
  }

  async listResources(): Promise<ResourceSummary[]> {
    const rows = await this.prisma.getClient().resourceDefinition.findMany({
      orderBy: { key: 'asc' },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        actions: { orderBy: { action: 'asc' } },
        module: { select: { key: true } },
      },
    });

    return rows.map((row) => this.toResourceSummary(row));
  }

  async getResource(key: string): Promise<ResourceSummary> {
    const row = await this.prisma.getClient().resourceDefinition.findUnique({
      where: { key },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        actions: { orderBy: { action: 'asc' } },
        module: { select: { key: true } },
      },
    });

    if (!row) {
      throw new NotFoundError('Resource not found.');
    }

    return this.toResourceSummary(row);
  }

  // ------------------------------------------------------------- applications

  async createApplication(
    input: CreateApplicationInput,
    actor: RegistryActor,
  ): Promise<ApplicationSummary> {
    if (!SLUG.test(input.key)) {
      throw new ValidationError('The application key is not a valid slug.', [
        { field: 'key', message: 'Use lowercase letters, digits and hyphens, e.g. project-app.' },
      ]);
    }
    if (await this.findApplication(input.key)) {
      throw new ConflictError(`An application with key "${input.key}" is already registered.`);
    }

    const application = await this.prisma.getClient().application.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        createdBy: actor.userId,
      },
    });

    await this.audit(actor, 'registry.application.created', application.id, {
      key: application.key,
    });

    return this.toApplicationSummary(application);
  }

  async updateApplication(
    key: string,
    input: UpdateApplicationInput,
    actor: RegistryActor,
  ): Promise<ApplicationSummary> {
    await this.requireApplication(key);

    const application = await this.prisma.getClient().application.update({
      where: { key },
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      },
    });

    await this.audit(actor, 'registry.application.updated', application.id, { key });

    return this.toApplicationSummary(application);
  }

  // ------------------------------------------------------------------ modules

  async createModule(input: CreateModuleInput, actor: RegistryActor): Promise<ModuleSummary> {
    if (!MODULE_KEY.test(input.key)) {
      throw new ValidationError('The module key is not valid.', [
        {
          field: 'key',
          message: 'Use uppercase letters, digits and underscores, e.g. M10_PROJECTS.',
        },
      ]);
    }
    const application = await this.requireApplication(input.applicationKey);
    if (await this.findModule(input.key)) {
      throw new ConflictError(`A module with key "${input.key}" is already registered.`);
    }

    const module = await this.prisma.getClient().appModule.create({
      data: {
        applicationId: application.id,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdBy: actor.userId,
      },
    });

    await this.audit(actor, 'registry.module.created', module.id, {
      key: module.key,
      applicationKey: application.key,
    });

    return this.toModuleSummary(module);
  }

  async updateModule(
    key: string,
    input: UpdateModuleInput,
    actor: RegistryActor,
  ): Promise<ModuleSummary> {
    await this.requireModule(key);

    const module = await this.prisma.getClient().appModule.update({
      where: { key },
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    await this.audit(actor, 'registry.module.updated', module.id, { key });

    return this.toModuleSummary(module);
  }

  // ---------------------------------------------------------------- resources

  async createResource(input: CreateResourceInput, actor: RegistryActor): Promise<ResourceSummary> {
    if (!SLUG.test(input.key)) {
      throw new ValidationError('The resource key is not a valid slug.', [
        { field: 'key', message: 'Use lowercase letters, digits and hyphens, e.g. project-task.' },
      ]);
    }
    const application = await this.requireApplication(input.applicationKey);
    const module = input.moduleKey ? await this.requireModule(input.moduleKey) : null;
    if (await this.findResource(input.key)) {
      throw new ConflictError(`A resource with key "${input.key}" is already registered.`);
    }

    const resource = await this.prisma.getClient().resourceDefinition.create({
      data: {
        applicationId: application.id,
        moduleId: module?.id ?? null,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        resourceType: input.resourceType,
        supportsCrud: input.supportsCrud ?? false,
        createdBy: actor.userId,
      },
    });

    await this.audit(actor, 'registry.resource.created', resource.id, {
      key: resource.key,
      applicationKey: application.key,
      moduleKey: module?.key ?? null,
    });

    return this.getResource(resource.key);
  }

  async updateResource(
    key: string,
    input: UpdateResourceInput,
    actor: RegistryActor,
  ): Promise<ResourceSummary> {
    await this.requireResource(key);

    await this.prisma.getClient().resourceDefinition.update({
      where: { key },
      data: {
        name: input.name,
        description: input.description,
        resourceType: input.resourceType,
        supportsCrud: input.supportsCrud,
        isActive: input.isActive,
      },
    });

    await this.audit(actor, 'registry.resource.updated', key, { key });

    return this.getResource(key);
  }

  async addResourceField(
    resourceKey: string,
    input: CreateResourceFieldInput,
    actor: RegistryActor,
  ): Promise<ResourceSummary> {
    if (!SLUG.test(input.key)) {
      throw new ValidationError('The field key is not a valid slug.', [
        { field: 'key', message: 'Use lowercase letters, digits and hyphens, e.g. due-date.' },
      ]);
    }
    const resource = await this.requireResource(resourceKey);

    const existing = await this.prisma.getClient().resourceField.findUnique({
      where: { resourceId_key: { resourceId: resource.id, key: input.key } },
    });
    if (existing) {
      throw new ConflictError(`The resource already has a field named "${input.key}".`);
    }

    await this.prisma.getClient().resourceField.create({
      data: {
        resourceId: resource.id,
        key: input.key,
        label: input.label,
        dataType: input.dataType,
        required: input.required ?? false,
        isSensitive: input.isSensitive ?? false,
        sortOrder: input.sortOrder ?? 0,
        createdBy: actor.userId,
      },
    });

    await this.audit(actor, 'registry.resource.field_added', resource.id, {
      resourceKey,
      fieldKey: input.key,
    });

    return this.getResource(resourceKey);
  }

  async addResourceAction(
    resourceKey: string,
    input: CreateRegisteredActionInput,
    actor: RegistryActor,
  ): Promise<ResourceSummary> {
    if (!ACTION_KEY.test(input.action)) {
      throw new ValidationError('The action key is not valid.', [
        {
          field: 'action',
          message: 'Use lowercase letters, digits and underscores, e.g. approve.',
        },
      ]);
    }
    const resource = await this.requireResource(resourceKey);

    const existing = await this.prisma.getClient().registeredAction.findUnique({
      where: { resourceId_action: { resourceId: resource.id, action: input.action } },
    });
    if (existing) {
      throw new ConflictError(`The resource already registers the action "${input.action}".`);
    }

    await this.prisma.getClient().registeredAction.create({
      data: {
        resourceId: resource.id,
        action: input.action,
        name: input.name,
        description: input.description ?? null,
        isCustom: input.isCustom ?? true,
        createdBy: actor.userId,
      },
    });

    await this.audit(actor, 'registry.resource.action_added', resource.id, {
      resourceKey,
      action: input.action,
    });

    return this.getResource(resourceKey);
  }

  // ------------------------------------------------------------------ helpers

  private async audit(
    actor: RegistryActor,
    action: string,
    resourceId: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.logs.writeAudit(actor.companyId, {
      action,
      resource: 'registry',
      resourceId,
      actorUserId: actor.userId,
      payload,
    });
  }

  private findApplication(key: string) {
    return this.prisma.getClient().application.findUnique({ where: { key } });
  }

  private async requireApplication(key: string) {
    const application = await this.findApplication(key);
    if (!application) {
      throw new NotFoundError(`No application is registered with key "${key}".`);
    }
    return application;
  }

  private findModule(key: string) {
    return this.prisma.getClient().appModule.findUnique({ where: { key } });
  }

  private async requireModule(key: string) {
    const module = await this.findModule(key);
    if (!module) {
      throw new NotFoundError(`No module is registered with key "${key}".`);
    }
    return module;
  }

  private findResource(key: string) {
    return this.prisma.getClient().resourceDefinition.findUnique({ where: { key } });
  }

  private async requireResource(key: string) {
    const resource = await this.findResource(key);
    if (!resource) {
      throw new NotFoundError(`No resource is registered with key "${key}".`);
    }
    return resource;
  }

  private toApplicationSummary(row: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
  }): ApplicationSummary {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toModuleSummary(row: {
    id: string;
    applicationId: string;
    key: string;
    name: string;
    description: string | null;
    moduleId: string | null;
    isActive: boolean;
    sortOrder: number;
  }): ModuleSummary {
    return {
      id: row.id,
      applicationId: row.applicationId,
      key: row.key,
      name: row.name,
      description: row.description,
      moduleId: row.moduleId,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  private toResourceSummary(row: {
    id: string;
    applicationId: string;
    moduleId: string | null;
    key: string;
    name: string;
    description: string | null;
    resourceType: ResourceSummary['resourceType'];
    supportsCrud: boolean;
    isActive: boolean;
    module: { key: string } | null;
    fields: readonly {
      id: string;
      key: string;
      label: string;
      dataType: ResourceSummary['fields'][number]['dataType'];
      required: boolean;
      isSensitive: boolean;
      sortOrder: number;
    }[];
    actions: readonly {
      id: string;
      action: string;
      name: string;
      description: string | null;
      isCustom: boolean;
    }[];
  }): ResourceSummary {
    return {
      id: row.id,
      applicationId: row.applicationId,
      moduleId: row.moduleId,
      key: row.key,
      name: row.name,
      description: row.description,
      resourceType: row.resourceType,
      moduleKey: row.module?.key ?? null,
      supportsCrud: row.supportsCrud,
      isActive: row.isActive,
      fields: row.fields.map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        dataType: field.dataType,
        required: field.required,
        isSensitive: field.isSensitive,
        sortOrder: field.sortOrder,
      })),
      actions: row.actions.map((action) => ({
        id: action.id,
        action: action.action,
        name: action.name,
        description: action.description,
        isCustom: action.isCustom,
      })),
    };
  }
}
