'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import type { AiUsageBucket } from '@hris/shared-types';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import { useIamLoad } from '@/features/iam/use-iam-data';

/**
 * The bucket rows the shared table renders. `AiUsageBucket` carries no primary key of
 * its own, so each breakdown adds the key it was already keyed by when the screen
 * hand-rolled its `<tr>`s: `provider/model` for by-model, `day` for by-day and
 * `feature` for by-feature.
 */
type ModelUsageRow = AiUsageBucket & {
  readonly provider: string;
  readonly model: string;
  readonly id: string;
};
type DayUsageRow = AiUsageBucket & { readonly day: string; readonly id: string };
type FeatureUsageRow = AiUsageBucket & { readonly feature: string; readonly id: string };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

function spend(bucket: AiUsageBucket): string {
  if (bucket.estimatedCostUsd === null) {
    return '—';
  }
  return `$${bucket.estimatedCostUsd.toFixed(2)}`;
}

function tokens(bucket: AiUsageBucket): string {
  return `${bucket.inputTokens.toLocaleString()} in · ${bucket.outputTokens.toLocaleString()} out`;
}

function StatCards({ totals }: { totals: AiUsageBucket }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Calls" value={String(totals.calls)} hint={`${totals.failed} failed`} />
      <Stat label="Tokens" value={tokens(totals)} hint="input / output over the sample" />
      <Stat label="Spend" value={spend(totals)} hint="estimated from model pricing" />
      <Stat
        label="Success rate"
        value={totals.calls === 0 ? '—' : `${Math.round((totals.succeeded / totals.calls) * 100)}%`}
        hint={`${totals.succeeded} succeeded`}
      />
    </div>
  );
}

/** The Calls / Tokens / Spend columns shared by all three breakdowns. */
function usageMetricColumns<
  TRow extends AiUsageBucket & { readonly id: string },
>(): readonly DataTableColumn<TRow>[] {
  return [
    {
      id: 'calls',
      header: 'Calls',
      align: 'right',
      sortValue: (row) => row.calls,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => row.calls,
    },
    {
      id: 'tokens',
      header: 'Tokens',
      align: 'right',
      sortValue: (row) => row.inputTokens + row.outputTokens,
      cellClassName: 'text-right text-sm',
      cell: (row) => tokens(row),
    },
    {
      id: 'spend',
      header: 'Spend',
      align: 'right',
      // Unpriced buckets (`—`) sort ahead of every real amount rather than after it.
      sortValue: (row) => row.estimatedCostUsd ?? -1,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => spend(row),
    },
  ];
}

/**
 * Usage & Cost: token consumption and estimated spend over the most recent AI calls,
 * broken down by model, day and feature. Spend is only shown where the model carries a
 * price in the Models catalogue — otherwise the bucket reports `—` rather than guessing.
 *
 * The load state is screen-level: the summary, the stat cards and the three tables all
 * come from one request, so the skeleton, the error panel and the top-level empty state
 * stay above the content. Each table owns its own per-breakdown empty state — "No calls
 * in the sample" — and its own no-results state when a search removes every row.
 */
export function UsageCostScreen() {
  const router = useRouter();
  const { state } = useSession();
  const usage = useIamLoad(() => aiApi.usage(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const data = usage.data;

  const modelRows: readonly ModelUsageRow[] =
    data?.byModel.map((row) => ({ ...row, id: `${row.provider}/${row.model}` })) ?? [];
  const dayRows: readonly DayUsageRow[] = data?.byDay.map((row) => ({ ...row, id: row.day })) ?? [];
  const featureRows: readonly FeatureUsageRow[] =
    data?.byFeature.map((row) => ({ ...row, id: row.feature })) ?? [];

  const modelColumns: readonly DataTableColumn<ModelUsageRow>[] = [
    {
      id: 'model',
      header: 'Model',
      sortValue: (row) => row.model,
      cell: (row) => (
        <div>
          <div className="font-mono text-sm">{row.model}</div>
          <div className="text-xs text-muted-foreground">{row.provider}</div>
        </div>
      ),
    },
    ...usageMetricColumns<ModelUsageRow>(),
  ];

  const dayColumns: readonly DataTableColumn<DayUsageRow>[] = [
    {
      id: 'day',
      header: 'Day',
      sortValue: (row) => row.day,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.day,
    },
    ...usageMetricColumns<DayUsageRow>(),
  ];

  const featureColumns: readonly DataTableColumn<FeatureUsageRow>[] = [
    {
      id: 'feature',
      header: 'Feature',
      sortValue: (row) => row.feature,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.feature,
    },
    ...usageMetricColumns<FeatureUsageRow>(),
  ];

  return (
    <PageBody>
      <PageHeader
        title="Usage & Cost"
        description="Token consumption and spend across model requests."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={usage.loading}
            onClick={() => usage.reload()}
          >
            <RefreshCw className="mr-1 size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      <ErrorPanel error={usage.error} onRetry={() => usage.reload()} />

      {usage.loading ? (
        <Skeleton className="h-60 w-full" />
      ) : data === null ? (
        <EmptyState title="No usage recorded yet" />
      ) : (
        <div className="flex flex-col gap-6">
          {!data.pricingConfigured && (
            <Alert>
              <AlertDescription>
                Pricing is missing for at least one model in the sample — spend shows as “—” for
                those rows. Add prices under Models to enable full spend reporting.
              </AlertDescription>
            </Alert>
          )}

          <StatCards totals={data.totals} />

          <section className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-medium">By model</h3>
              <p className="text-sm text-muted-foreground">
                {data.sampledCalls} call(s) sampled · {new Date(data.sampledAt).toLocaleString()}
              </p>
            </div>
            <HrisDataTable
              rows={modelRows}
              columns={modelColumns}
              searchable={false}
              selectable={false}
              emptyTitle="No calls in the sample"
              noResultsTitle="No rows match this filter"
              noResultsDescription="Try a different search, or clear the filters to see every row."
            />
          </section>

          <section className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-medium">By day</h3>
              <p className="text-sm text-muted-foreground">
                Daily activity within the sample window
              </p>
            </div>
            <HrisDataTable
              rows={dayRows}
              columns={dayColumns}
              searchable={false}
              selectable={false}
              emptyTitle="No calls in the sample"
              noResultsTitle="No rows match this filter"
              noResultsDescription="Try a different search, or clear the filters to see every row."
            />
          </section>

          <section className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-medium">By feature</h3>
              <p className="text-sm text-muted-foreground">Which surfaces issued the requests</p>
            </div>
            <HrisDataTable
              rows={featureRows}
              columns={featureColumns}
              searchable={false}
              selectable={false}
              emptyTitle="No calls in the sample"
              noResultsTitle="No rows match this filter"
              noResultsDescription="Try a different search, or clear the filters to see every row."
            />
          </section>
        </div>
      )}
    </PageBody>
  );
}
