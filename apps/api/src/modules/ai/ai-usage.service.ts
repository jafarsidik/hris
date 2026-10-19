import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { AiCallSummary, AiUsageBucket, AiUsageSummary } from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';

/** How many recent calls the aggregate reads; older history falls out of the window. */
const SAMPLE_SIZE = 1000;

interface Accumulator {
  calls: number;
  succeeded: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** False once one call in the bucket has no configured price for its model. */
  priced: boolean;
}

function emptyBucket(): Accumulator {
  return {
    calls: 0,
    succeeded: 0,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    priced: true,
  };
}

function addCall(
  bucket: Accumulator,
  call: {
    inputTokens: number;
    outputTokens: number;
    status: string;
    costUsd: number | null;
  },
): void {
  bucket.calls += 1;
  if (call.status === 'SUCCESS') bucket.succeeded += 1;
  else bucket.failed += 1;
  bucket.inputTokens += call.inputTokens;
  bucket.outputTokens += call.outputTokens;
  if (call.costUsd === null) {
    bucket.priced = false;
  } else {
    bucket.cost += call.costUsd;
  }
}

function seal(bucket: Accumulator): AiUsageBucket {
  return {
    calls: bucket.calls,
    succeeded: bucket.succeeded,
    failed: bucket.failed,
    inputTokens: bucket.inputTokens,
    outputTokens: bucket.outputTokens,
    estimatedCostUsd: bucket.priced ? Math.round(bucket.cost * 1e6) / 1e6 : null,
  };
}

/**
 * Read side over `ai_calls`: the raw request log (AI Logs) and the token/cost rollup
 * (Usage & Cost).
 *
 * Spend is derived from the `ai_models` price list — a call whose model carries no
 * price makes its bucket's `estimatedCostUsd` null rather than guessing, so the screen
 * can say "pricing incomplete" instead of under-reporting.
 */
@Injectable()
export class AiUsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCalls(
    companyId: string,
    options: { readonly status?: string; readonly limit?: number } = {},
  ): Promise<readonly AiCallSummary[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.aiCall.findMany({
        where: options.status === undefined ? undefined : { status: options.status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        latencyMs: row.latencyMs,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }

  async usage(companyId: string): Promise<AiUsageSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const [calls, models] = await Promise.all([
        tx.aiCall.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: SAMPLE_SIZE,
        }),
        tx.aiModel.findMany({
          select: { key: true, inputPricePerMillion: true, outputPricePerMillion: true },
        }),
      ]);

      const prices = new Map(
        models
          .filter(
            (model) => model.inputPricePerMillion !== null && model.outputPricePerMillion !== null,
          )
          .map((model) => [
            model.key,
            {
              input: model.inputPricePerMillion?.toNumber() ?? 0,
              output: model.outputPricePerMillion?.toNumber() ?? 0,
            },
          ]),
      );
      const observed = new Set<string>();

      const totals = emptyBucket();
      const byModel = new Map<string, Accumulator & { provider: string; model: string }>();
      const byDay = new Map<string, Accumulator>();
      const byFeature = new Map<string, Accumulator>();

      for (const call of calls) {
        observed.add(call.model);
        const price = prices.get(call.model);
        const costUsd =
          price === undefined
            ? null
            : (call.inputTokens / 1_000_000) * price.input +
              (call.outputTokens / 1_000_000) * price.output;
        const record = {
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          status: call.status,
          costUsd,
        };

        addCall(totals, record);

        const modelKey = `${call.provider}/${call.model}`;
        let modelBucket = byModel.get(modelKey);
        if (modelBucket === undefined) {
          modelBucket = { ...emptyBucket(), provider: call.provider, model: call.model };
          byModel.set(modelKey, modelBucket);
        }
        addCall(modelBucket, record);

        const day = call.createdAt.toISOString().slice(0, 10);
        let dayBucket = byDay.get(day);
        if (dayBucket === undefined) {
          dayBucket = emptyBucket();
          byDay.set(day, dayBucket);
        }
        addCall(dayBucket, record);

        let featureBucket = byFeature.get(call.feature);
        if (featureBucket === undefined) {
          featureBucket = emptyBucket();
          byFeature.set(call.feature, featureBucket);
        }
        addCall(featureBucket, record);
      }

      const pricingConfigured =
        calls.length === 0 || [...observed].every((model) => prices.has(model));

      return {
        totals: seal(totals),
        byModel: [...byModel.entries()]
          .sort((a, b) => b[1].calls - a[1].calls)
          .map(([, bucket]) => ({
            ...seal(bucket),
            provider: bucket.provider,
            model: bucket.model,
          })),
        byDay: [...byDay.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([day, bucket]) => ({ ...seal(bucket), day })),
        byFeature: [...byFeature.entries()]
          .sort((a, b) => b[1].calls - a[1].calls)
          .map(([feature, bucket]) => ({ ...seal(bucket), feature })),
        pricingConfigured,
        sampledCalls: calls.length,
        sampledAt: new Date().toISOString(),
      };
    });
  }
}
