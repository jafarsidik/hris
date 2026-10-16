import { Inject, Injectable, Logger } from '@nestjs/common';

import { withTenantContext } from '@hris/database';

import { ServiceUnavailableError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AiProviderService } from './ai-provider.service';
import { KnowledgeService } from './knowledge.service';
import { redactText, hashText } from './redact';
import type { AiAskInput, AiAskResponse } from '@hris/shared-types';

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

  async ask(companyId: string, userId: string, input: AiAskInput): Promise<AiAskResponse> {
    if (!(await this.knowledge.isEnabled(companyId))) {
      throw new ServiceUnavailableError(
        'AI is not enabled for this company (AI_ENABLED plus `ai.enabled` company setting).',
      );
    }

    const redacted = redactText(input.question);
    const limit = Math.min(20, Math.max(1, input.limit ?? 5));
    const startedAt = Date.now();

    const sources = await this.knowledge.retrieve(companyId, redacted.text, limit);
    const context = sources
      .map((source, index) => `[${index + 1}] ${source.title}\n${source.excerpt}`)
      .join('\n\n---\n\n');

    // We only put publishable excerpt names + ids into the prompt (no personal data).
    // The full text is retrieved server-side by id but not sent wholesale to avoid
    // large prompts; cite source id so the answer can reference it.
    const systemMessage = {
      role: 'system' as const,
      content:
        'You are the HRIS policy assistant. Answer only using the provided sources. ' +
        'Cite sources using bracketed numbers like [1]. If unsure, say so. Never invent ' +
        'figures. Keep it concise.',
    };
    const userMessage = {
      role: 'user' as const,
      content: `Question: ${redacted.text}\n\nSources:\n${context}`,
    };

    const result = await this.provider.complete([systemMessage, userMessage], {
      maxTokens: 512,
      temperature: 0.2,
    });

    const latencyMs = Date.now() - startedAt;
    const answer = result === null ? 'Unavailable right now — try again shortly.' : result.content;
    const inputTokens = result?.inputTokens ?? 0;
    const outputTokens = result?.outputTokens ?? 0;

    const status = result === null ? 'FAILED' : 'SUCCESS';

    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await (
        tx as unknown as { aiCall: { create: (args: unknown) => Promise<unknown> } }
      ).aiCall.create({
        data: {
          companyId,
          userId,
          feature: 'policy-faq',
          provider: this.provider.cfg.provider,
          model: this.provider.cfg.model,
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
}
