import { Inject, Injectable, Logger } from '@nestjs/common';

import { withTenantContext } from '@hris/database';

import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../database/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { type AiKnowledgeDocumentSummary } from '@hris/shared-types';

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    ma += av * av;
    mb += bv * bv;
  }
  if (ma === 0 || mb === 0) {
    return 0;
  }
  return dot / Math.sqrt(ma * mb);
}

interface DocRow {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly source: string | null;
  readonly status: string;
  readonly content: string;
  readonly embedding: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface KnowledgeEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly source: string | null;
  readonly content: string;
  readonly embedding: readonly number[] | null;
}

export interface RetrievedDoc {
  readonly id: string;
  readonly title: string;
  readonly score: number;
  readonly excerpt: string;
}

/**
 * Knowledge base of published policy text.
 *
 * Documents may be provided already in public form (handbook excerpts, published
 * policies). Content is embedded with the provider's embedding endpoint and
 * similarity-searched at question time. The gateway never sends personal data:
 * content is published text only, and redaction is applied again before retrieval.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(AiProviderService) private readonly provider: AiProviderService,
  ) {}

  /** Whether AI is enabled for this tenant (global + company setting). */
  async isEnabled(companyId: string): Promise<boolean> {
    if (!this.provider.cfg.enabled) {
      return false;
    }
    const value = await this.settings.getEffectiveSetting(companyId, 'ai.enabled');
    return value === true;
  }

  async list(companyId: string): Promise<AiKnowledgeDocumentSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.aiKnowledgeDocument.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row: DocRow) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        source: row.source,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  async create(
    companyId: string,
    userId: string,
    input: { title: string; kind: string; source?: string | null; content: string },
  ): Promise<AiKnowledgeDocumentSummary> {
    const embeddings = await this.provider.embed([input.content.slice(0, 8000)]);
    const embedding = embeddings === null ? null : (embeddings[0] ?? null);

    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.aiKnowledgeDocument.create({
        data: {
          companyId,
          title: input.title,
          kind: input.kind,
          source: input.source ?? null,
          content: input.content,
          embedding: embedding as unknown as object,
          createdByUserId: userId,
        },
      });
      return {
        id: (row as unknown as { id: string }).id,
        title: input.title,
        kind: input.kind,
        source: input.source ?? null,
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.aiKnowledgeDocument.deleteMany({
        where: { id },
      });
    });
  }

  /** Retrieves the top published (and similar) documents for `query`. */
  async retrieve(companyId: string, query: string, limit: number): Promise<RetrievedDoc[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, async (tx) => {
      return tx.aiKnowledgeDocument.findMany({
        where: { status: 'PUBLISHED' },
      });
    });
    const rowsTyped = rows as unknown as DocRow[];
    if (rowsTyped.length === 0) {
      return [];
    }

    const embeddings = await this.provider.embed([query.slice(0, 8000)]);
    const queryEmbed = embeddings === null ? null : (embeddings[0] ?? null);

    if (queryEmbed === null) {
      // Provider (or its API key) unavailable: fall back to substring matching.
      const queryLower = query.toLowerCase();
      return rowsTyped
        .filter(
          (row) =>
            row.content.toLowerCase().includes(queryLower) ||
            row.title.toLowerCase().includes(queryLower),
        )
        .slice(0, limit)
        .map((row, index) => ({
          id: row.id,
          title: row.title,
          score: 1 - index * 0.01,
          excerpt: row.content.slice(0, 600),
        }));
    }

    const scored = rowsTyped.map((row) => {
      const embedding = Array.isArray(row.embedding) ? (row.embedding as number[]) : null;
      return {
        id: row.id,
        title: row.title,
        score: embedding === null ? 0 : cosine(embedding, queryEmbed),
        excerpt: row.content.slice(0, 600),
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}
