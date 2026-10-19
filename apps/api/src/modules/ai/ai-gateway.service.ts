import { Inject, Injectable, Logger } from '@nestjs/common';

import { withTenantContext } from '@hris/database';

import { NotFoundError, ServiceUnavailableError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AiProviderService } from './ai-provider.service';
import { KnowledgeService } from './knowledge.service';
import { redactText, hashText } from './redact';
import type { AiAskInput, AiAskResponse, AiProviderSummary } from '@hris/shared-types';

/** Prompt key whose enabled version replaces the built-in system prompt. */
const DEFAULT_PROMPT_KEY = 'policy-faq.system';
/** Built-in tool gating knowledge retrieval on `/ai/ask`. */
const KNOWLEDGE_TOOL_KEY = 'knowledge.search';

const BUILTIN_SYSTEM_PROMPT =
  'You are the HRIS policy assistant. Answer only using the provided sources. ' +
  'Cite sources using bracketed numbers like [1]. If unsure, say so. Never invent ' +
  'figures. Keep it concise.';

function toolsOf(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

interface ResolvedConfig {
  /** The requested agent, or `null` when none was requested. */
  readonly agent: {
    readonly key: string;
    readonly promptKey: string | null;
    readonly modelKey: string | null;
    readonly tools: readonly string[];
  } | null;
  /** True when an agentKey was supplied but matched no enabled agent. */
  readonly agentMissing: boolean;
  /** Enabled prompt content for the effective key, or `null` to use the built-in. */
  readonly systemContent: string | null;
  /** Whether the knowledge tool is available (absence of an override = available). */
  readonly knowledgeEnabled: boolean;
  /** The tenant's default-enabled model, if any. */
  readonly defaultModelKey: string | null;
}

/**
 * The AI request path: permission-free tenant config resolution, retrieval, completion
 * and the `ai_calls` audit write.
 *
 * Configuration comes from three registries consulted in one tenant read: an agent (when
 * `agentKey` is supplied) picks the prompt key, model key and granted tools; an enabled
 * prompt version overrides the built-in system text; the tool override table can gate
 * knowledge retrieval off. Absence anywhere falls back to today's defaults, so a fresh
 * tenant behaves exactly as before the registries existed.
 */
@Injectable()
export class AiGateway {
  private readonly logger = new Logger(AiGateway.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(AiProviderService) private readonly provider: AiProviderService,
  ) {}

  async isEnabled(companyId: string): Promise<boolean> {
    return this.knowledge.isEnabled(companyId);
  }

  /**
   * Effective provider configuration for Providers. Only ever exposes whether a key
   * exists — the key itself stays in the environment and is never returned.
   */
  async providers(companyId: string): Promise<readonly AiProviderSummary[]> {
    const cfg = this.provider.cfg;
    const value = await this.settings.getEffectiveSetting(companyId, 'ai.enabled');
    return [
      {
        key: cfg.provider,
        name: cfg.provider,
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        timeoutMs: cfg.timeoutMs,
        envEnabled: cfg.enabled,
        apiKeyConfigured: typeof cfg.apiKey === 'string' && cfg.apiKey.trim() !== '',
        companyEnabled: value === true,
        source: 'environment',
      },
    ];
  }

  async ask(companyId: string, userId: string, input: AiAskInput): Promise<AiAskResponse> {
    if (!(await this.knowledge.isEnabled(companyId))) {
      throw new ServiceUnavailableError(
        'AI is not enabled for this company (AI_ENABLED plus `ai.enabled` company setting).',
      );
    }

    const redacted = redactText(input.question);
    const limit = Math.min(20, Math.max(1, input.limit ?? 5));
    const startedAt = Date.now();

    const config = await this.resolveConfig(companyId, input.agentKey);
    if (config.agentMissing) {
      throw new NotFoundError(`Unknown or disabled agent "${input.agentKey ?? ''}".`);
    }

    // Retrieval happens only when the agent grants the tool and the tenant has not
    // gated it off; either way the assistant is told what it may use.
    const knowledgeAllowed =
      (config.agent === null || config.agent.tools.includes(KNOWLEDGE_TOOL_KEY)) &&
      config.knowledgeEnabled;
    const sources = knowledgeAllowed
      ? await this.knowledge.retrieve(companyId, redacted.text, limit)
      : [];
    const context = sources
      .map((source, index) => `[${index + 1}] ${source.title}\n${source.excerpt}`)
      .join('\n\n---\n\n');

    // We only put publishable excerpt names + ids into the prompt (no personal data).
    // The full text is retrieved server-side by id but not sent wholesale to avoid
    // large prompts; cite source id so the answer can reference it.
    const systemContent = config.systemContent ?? BUILTIN_SYSTEM_PROMPT;
    const systemMessage = { role: 'system' as const, content: systemContent };
    const userMessage = {
      role: 'user' as const,
      content: `Question: ${redacted.text}\n\nSources:\n${context}`,
    };

    const effectiveModel =
      config.agent?.modelKey ?? config.defaultModelKey ?? this.provider.cfg.model;

    const result = await this.provider.complete([systemMessage, userMessage], {
      maxTokens: 512,
      temperature: 0.2,
      model: effectiveModel,
    });

    const latencyMs = Date.now() - startedAt;
    const answer = result === null ? 'Unavailable right now — try again shortly.' : result.content;
    const inputTokens = result?.inputTokens ?? 0;
    const outputTokens = result?.outputTokens ?? 0;

    const status = result === null ? 'FAILED' : 'SUCCESS';

    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.aiCall.create({
        data: {
          companyId,
          userId,
          feature: config.agent === null ? 'policy-faq' : `agent:${config.agent.key}`,
          provider: this.provider.cfg.provider,
          model: effectiveModel,
          promptHash: hashText(redacted.text),
          inputTokens,
          outputTokens,
          latencyMs,
          status,
        },
      });
    }).catch(() => undefined);

    return {
      answer,
      sources: sources.map((source) => ({
        id: source.id,
        title: source.title,
        score: source.score,
      })),
      latencyMs,
    };
  }

  /** One tenant-scoped read that resolves agent, prompt, tool gate and default model. */
  private async resolveConfig(
    companyId: string,
    agentKey: string | undefined,
  ): Promise<ResolvedConfig> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      let agent: ResolvedConfig['agent'] = null;
      let agentMissing = false;
      if (agentKey !== undefined) {
        const row = await tx.aiAgent.findFirst({ where: { key: agentKey, isEnabled: true } });
        if (row === null) {
          agentMissing = true;
        } else {
          agent = {
            key: row.key,
            promptKey: row.promptKey,
            modelKey: row.modelKey,
            tools: toolsOf(row.tools),
          };
        }
      }

      const promptKey = agent?.promptKey ?? DEFAULT_PROMPT_KEY;
      const [prompt, toolOverride, defaultModel] = await Promise.all([
        tx.aiPrompt.findFirst({
          where: { key: promptKey, isEnabled: true },
          orderBy: { version: 'desc' },
          select: { content: true },
        }),
        tx.aiToolOverride.findFirst({ where: { key: KNOWLEDGE_TOOL_KEY } }),
        tx.aiModel.findFirst({
          where: { isEnabled: true, isDefault: true },
          select: { key: true },
        }),
      ]);

      return {
        agent,
        agentMissing,
        systemContent: prompt?.content ?? null,
        knowledgeEnabled: toolOverride?.isEnabled ?? true,
        defaultModelKey: defaultModel?.key ?? null,
      };
    });
  }
}
