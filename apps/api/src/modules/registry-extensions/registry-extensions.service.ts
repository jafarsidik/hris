import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type {
  ConfigurationSchemaInput,
  ConfigurationSchemaSummary,
  ExtensionInput,
  ExtensionSummary,
} from '@hris/shared-types';

import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface Actor {
  companyId: string;
  userId: string;
}

interface SchemaRow {
  readonly id: string;
  readonly resourceKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly schemaJson: unknown;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ExtensionRow {
  readonly id: string;
  readonly extensionKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: string;
  readonly manifest: unknown;
  readonly isEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toSchemaSummary(row: SchemaRow): ConfigurationSchemaSummary {
  return {
    id: row.id,
    resourceKey: row.resourceKey,
    name: row.name,
    description: row.description,
    schemaJson:
      typeof row.schemaJson === 'object' &&
      row.schemaJson !== null &&
      !Array.isArray(row.schemaJson)
        ? (row.schemaJson as Record<string, unknown>)
        : {},
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExtensionSummary(row: ExtensionRow): ExtensionSummary {
  return {
    id: row.id,
    extensionKey: row.extensionKey,
    name: row.name,
    description: row.description,
    version: row.version,
    manifest:
      typeof row.manifest === 'object' && row.manifest !== null && !Array.isArray(row.manifest)
        ? (row.manifest as Record<string, unknown>)
        : {},
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Configuration schemas and extension registry.
 *
 * Both are tenant-scoped metadata tables. Configuration schemas declare the shape a
 * registered resource's configuration must satisfy; the extension registry lists
 * third-party and customer extensions with their manifest.
 */
@Injectable()
export class RegistryExtensionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ------------------------------------------------------------------ schemas

  async listSchemas(companyId: string): Promise<ConfigurationSchemaSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          configurationSchema: { findMany: (a: unknown) => Promise<SchemaRow[]> };
        }
      ).configurationSchema.findMany({ orderBy: { name: 'asc' } });
      return rows.map(toSchemaSummary);
    });
  }

  async createSchema(
    actor: Actor,
    input: ConfigurationSchemaInput,
  ): Promise<ConfigurationSchemaSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await (
        tx as unknown as {
          configurationSchema: { findFirst: (a: unknown) => Promise<SchemaRow | null> };
        }
      ).configurationSchema.findFirst({
        where: { resourceKey: input.resourceKey },
      });
      if (existing !== null) {
        throw new ConflictError('A configuration schema already exists for this resource.');
      }
      const row = await (
        tx as unknown as {
          configurationSchema: { create: (a: unknown) => Promise<SchemaRow> };
        }
      ).configurationSchema.create({
        data: {
          companyId: actor.companyId,
          resourceKey: input.resourceKey,
          name: input.name,
          description: input.description ?? null,
          schemaJson: input.schemaJson ?? {},
          isActive: input.isActive ?? true,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'configuration_schema.create',
        resource: 'configuration_schema',
        resourceId: row.id,
        payload: { resourceKey: input.resourceKey },
      });
      return toSchemaSummary(row);
    });
  }

  async updateSchema(
    actor: Actor,
    id: string,
    input: Partial<ConfigurationSchemaInput>,
  ): Promise<ConfigurationSchemaSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          configurationSchema: {
            findFirst: (a: unknown) => Promise<SchemaRow | null>;
            update: (a: unknown) => Promise<SchemaRow>;
          };
        }
      ).configurationSchema;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The configuration schema does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.resourceKey !== undefined ? { resourceKey: input.resourceKey } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.schemaJson !== undefined ? { schemaJson: input.schemaJson } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'configuration_schema.update',
        resource: 'configuration_schema',
        resourceId: id,
        payload: { resourceKey: existing.resourceKey },
      });
      return toSchemaSummary(row);
    });
  }

  async removeSchema(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          configurationSchema: {
            findFirst: (a: unknown) => Promise<SchemaRow | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).configurationSchema;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The configuration schema does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'configuration_schema.delete',
        resource: 'configuration_schema',
        resourceId: id,
        payload: { resourceKey: existing.resourceKey },
      });
    });
  }

  async toggleSchema(
    actor: Actor,
    id: string,
    isActive: boolean,
  ): Promise<ConfigurationSchemaSummary> {
    return this.updateSchema(actor, id, { isActive });
  }

  // ------------------------------------------------------------- extensions

  async listExtensions(companyId: string): Promise<ExtensionSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          extensionRegistry: { findMany: (a: unknown) => Promise<ExtensionRow[]> };
        }
      ).extensionRegistry.findMany({ orderBy: { name: 'asc' } });
      return rows.map(toExtensionSummary);
    });
  }

  async createExtension(actor: Actor, input: ExtensionInput): Promise<ExtensionSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await (
        tx as unknown as {
          extensionRegistry: { findFirst: (a: unknown) => Promise<ExtensionRow | null> };
        }
      ).extensionRegistry.findFirst({
        where: { extensionKey: input.extensionKey },
      });
      if (existing !== null) {
        throw new ConflictError('An extension with that key already exists.');
      }
      const row = await (
        tx as unknown as {
          extensionRegistry: { create: (a: unknown) => Promise<ExtensionRow> };
        }
      ).extensionRegistry.create({
        data: {
          companyId: actor.companyId,
          extensionKey: input.extensionKey,
          name: input.name,
          description: input.description ?? null,
          version: input.version,
          manifest: input.manifest ?? {},
          isEnabled: input.isEnabled ?? true,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'extension.create',
        resource: 'extension',
        resourceId: row.id,
        payload: { extensionKey: input.extensionKey },
      });
      return toExtensionSummary(row);
    });
  }

  async updateExtension(
    actor: Actor,
    id: string,
    input: Partial<ExtensionInput>,
  ): Promise<ExtensionSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          extensionRegistry: {
            findFirst: (a: unknown) => Promise<ExtensionRow | null>;
            update: (a: unknown) => Promise<ExtensionRow>;
          };
        }
      ).extensionRegistry;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The extension does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.extensionKey !== undefined ? { extensionKey: input.extensionKey } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.version !== undefined ? { version: input.version } : {}),
          ...(input.manifest !== undefined ? { manifest: input.manifest } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'extension.update',
        resource: 'extension',
        resourceId: id,
        payload: { extensionKey: existing.extensionKey },
      });
      return toExtensionSummary(row);
    });
  }

  async removeExtension(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          extensionRegistry: {
            findFirst: (a: unknown) => Promise<ExtensionRow | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).extensionRegistry;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The extension does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'extension.delete',
        resource: 'extension',
        resourceId: id,
        payload: { extensionKey: existing.extensionKey },
      });
    });
  }

  async toggleExtension(actor: Actor, id: string, isEnabled: boolean): Promise<ExtensionSummary> {
    return this.updateExtension(actor, id, { isEnabled });
  }
}
