import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import {
  AI_BUILTIN_TOOLS,
  type AiAgentSummary,
  type AiModelSummary,
  type AiPromptSummary,
  type AiToolSummary,
  type CreateAiAgentInput,
  type CreateAiModelInput,
  type CreateAiPromptInput,
  type UpdateAiAgentInput,
  type UpdateAiModelInput,
  type UpdateAiPromptInput,
} from '@hris/shared-types';

import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const MAX_VERSIONS_PER_KEY = 200;

function toPrice(value: { toNumber: () => number } | null): number | null {
  return value === null ? null : value.toNumber();
}

function toModelSummary(row: {
  id: string;
  key: string;
  name: string;
  provider: string;
  contextWindow: number | null;
  inputPricePerMillion: { toNumber: () => number } | null;
  outputPricePerMillion: { toNumber: () => number } | null;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AiModelSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    provider: row.provider,
    contextWindow: row.contextWindow,
    inputPricePerMillion: toPrice(row.inputPricePerMillion),
    outputPricePerMillion: toPrice(row.outputPricePerMillion),
    isDefault: row.isDefault,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRUD over the AI registries (models, prompts, agents) and the tool overrides.
 *
 * All four are tenant metadata: nothing here executes, it only configures what the
 * gateway consults on the next `/ai/ask` (prompt override, default model, granted
 * tools, tool gate). Uniqueness is checked inside the tenant transaction so a duplicate
 * key surfaces as a 409 rather than a driver error.
 */
@Injectable()
export class AiRegistryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Models ------------------------------------------------------------------

  async listModels(companyId: string): Promise<readonly AiModelSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.aiModel.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
      return rows.map(toModelSummary);
    });
  }

  async createModel(companyId: string, input: CreateAiModelInput): Promise<AiModelSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiModel.findFirst({ where: { key: input.key } });
      if (existing !== null) {
        throw new ConflictError(`A model with key "${input.key}" already exists.`);
      }
      const created = await tx.aiModel.create({
        data: {
          companyId,
          key: input.key,
          name: input.name,
          provider: input.provider ?? 'openai-compatible',
          contextWindow: input.contextWindow ?? null,
          inputPricePerMillion: input.inputPricePerMillion ?? null,
          outputPricePerMillion: input.outputPricePerMillion ?? null,
          isDefault: input.isDefault ?? false,
          isEnabled: input.isEnabled ?? true,
        },
      });
      if (created.isDefault) {
        await tx.aiModel.updateMany({
          where: { id: { not: created.id } },
          data: { isDefault: false },
        });
      }
      return toModelSummary(created);
    });
  }

  async updateModel(
    companyId: string,
    id: string,
    input: UpdateAiModelInput,
  ): Promise<AiModelSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiModel.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The model does not exist.');
      }
      const updated = await tx.aiModel.update({
        where: { id },
        data: {
          name: input.name,
          provider: input.provider,
          contextWindow: input.contextWindow,
          inputPricePerMillion: input.inputPricePerMillion,
          outputPricePerMillion: input.outputPricePerMillion,
          isDefault: input.isDefault,
          isEnabled: input.isEnabled,
        },
      });
      if (input.isDefault === true) {
        await tx.aiModel.updateMany({
          where: { id: { not: id } },
          data: { isDefault: false },
        });
      }
      return toModelSummary(updated);
    });
  }

  async removeModel(companyId: string, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiModel.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The model does not exist.');
      }
      await tx.aiModel.delete({ where: { id } });
    });
  }

  // Prompts -----------------------------------------------------------------

  async listPrompts(companyId: string): Promise<readonly AiPromptSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.aiPrompt.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
      return rows.map((row) => ({
        id: row.id,
        key: row.key,
        version: row.version,
        name: row.name,
        content: row.content,
        isEnabled: row.isEnabled,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  async createPrompt(companyId: string, input: CreateAiPromptInput): Promise<AiPromptSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      let version = input.version;
      if (version === undefined) {
        const highest = await tx.aiPrompt.findFirst({
          where: { key: input.key },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        version = highest === null ? 1 : highest.version + 1;
      }
      if (version > MAX_VERSIONS_PER_KEY) {
        throw new ValidationError(
          `A prompt key may hold at most ${MAX_VERSIONS_PER_KEY} versions.`,
        );
      }
      const duplicate = await tx.aiPrompt.findFirst({
        where: { key: input.key, version },
      });
      if (duplicate !== null) {
        throw new ConflictError(`Version ${version} of prompt "${input.key}" already exists.`);
      }
      const enabled = input.isEnabled ?? false;
      if (enabled) {
        // Exactly one live version per key: enabling this one retires its siblings.
        await tx.aiPrompt.updateMany({
          where: { key: input.key, isEnabled: true },
          data: { isEnabled: false },
        });
      }
      const created = await tx.aiPrompt.create({
        data: {
          companyId,
          key: input.key,
          version,
          name: input.name ?? null,
          content: input.content,
          isEnabled: enabled,
        },
      });
      return {
        id: created.id,
        key: created.key,
        version: created.version,
        name: created.name,
        content: created.content,
        isEnabled: created.isEnabled,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    });
  }

  async updatePrompt(
    companyId: string,
    id: string,
    input: UpdateAiPromptInput,
  ): Promise<AiPromptSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiPrompt.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The prompt version does not exist.');
      }
      if (input.isEnabled === true) {
        await tx.aiPrompt.updateMany({
          where: { key: existing.key, isEnabled: true, id: { not: id } },
          data: { isEnabled: false },
        });
      }
      const updated = await tx.aiPrompt.update({
        where: { id },
        data: {
          name: input.name,
          content: input.content,
          isEnabled: input.isEnabled,
        },
      });
      return {
        id: updated.id,
        key: updated.key,
        version: updated.version,
        name: updated.name,
        content: updated.content,
        isEnabled: updated.isEnabled,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async removePrompt(companyId: string, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiPrompt.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The prompt version does not exist.');
      }
      await tx.aiPrompt.delete({ where: { id } });
    });
  }

  // Agents ------------------------------------------------------------------

  async listAgents(companyId: string): Promise<readonly AiAgentSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.aiAgent.findMany({ orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }] });
      return rows.map(toAgentSummary);
    });
  }

  async createAgent(companyId: string, input: CreateAiAgentInput): Promise<AiAgentSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiAgent.findFirst({ where: { key: input.key } });
      if (existing !== null) {
        throw new ConflictError(`An agent with key "${input.key}" already exists.`);
      }
      const created = await tx.aiAgent.create({
        data: {
          companyId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          promptKey: input.promptKey ?? null,
          modelKey: input.modelKey ?? null,
          tools: input.tools ?? [],
          isEnabled: input.isEnabled ?? false,
        },
      });
      return toAgentSummary(created);
    });
  }

  async updateAgent(
    companyId: string,
    id: string,
    input: UpdateAiAgentInput,
  ): Promise<AiAgentSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiAgent.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The agent does not exist.');
      }
      const updated = await tx.aiAgent.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          promptKey: input.promptKey,
          modelKey: input.modelKey,
          tools: input.tools,
          isEnabled: input.isEnabled,
        },
      });
      return toAgentSummary(updated);
    });
  }

  async removeAgent(companyId: string, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiAgent.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The agent does not exist.');
      }
      await tx.aiAgent.delete({ where: { id } });
    });
  }

  // Tools -------------------------------------------------------------------

  /** Built-in tools merged with this tenant's overrides; absence keeps the default. */
  async listTools(companyId: string): Promise<readonly AiToolSummary[]> {
    const client = this.prisma.getClient();
    const overrides = await withTenantContext(client, companyId, (tx) =>
      tx.aiToolOverride.findMany(),
    );
    const byKey = new Map(overrides.map((row) => [row.key, row]));
    return AI_BUILTIN_TOOLS.map((tool) => {
      const override = byKey.get(tool.key);
      return override === undefined
        ? tool
        : {
            ...tool,
            isEnabled: override.isEnabled,
            overridden: true,
            overrideId: override.id,
          };
    });
  }

  /** Sets (or replaces) the tenant's availability override for a built-in tool. */
  async setTool(companyId: string, key: string, enabled: boolean): Promise<AiToolSummary> {
    const known = AI_BUILTIN_TOOLS.find((tool) => tool.key === key);
    if (known === undefined) {
      throw new ValidationError(`Unknown tool "${key}".`);
    }
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiToolOverride.findFirst({ where: { key } });
      const row =
        existing === null
          ? await tx.aiToolOverride.create({ data: { companyId, key, isEnabled: enabled } })
          : await tx.aiToolOverride.update({
              where: { id: existing.id },
              data: { isEnabled: enabled },
            });
      return {
        ...known,
        isEnabled: row.isEnabled,
        overridden: true,
        overrideId: row.id,
      };
    });
  }

  /** Removes the tenant override, restoring the built-in default availability. */
  async resetTool(companyId: string, key: string): Promise<AiToolSummary> {
    const known = AI_BUILTIN_TOOLS.find((tool) => tool.key === key);
    if (known === undefined) {
      throw new ValidationError(`Unknown tool "${key}".`);
    }
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.aiToolOverride.findFirst({ where: { key } });
      if (existing === null) {
        throw new NotFoundError(`Tool "${key}" has no override to remove.`);
      }
      await tx.aiToolOverride.delete({ where: { id: existing.id } });
      return known;
    });
  }
}

function toAgentSummary(row: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  promptKey: string | null;
  modelKey: string | null;
  tools: unknown;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AiAgentSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    promptKey: row.promptKey,
    modelKey: row.modelKey,
    tools: Array.isArray(row.tools)
      ? row.tools.filter((value): value is string => typeof value === 'string')
      : [],
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
