'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import type { AiUsageBucket, AiUsageSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import { useIamLoad } from '@/features/iam/use-iam-data';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
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

/**
 * Usage & Cost: token consumption and estimated spend over the most recent AI calls,
 * broken down by model, day and feature. Spend is only shown where the model carries a
 * price in the Models catalogue — otherwise the bucket reports `—` rather than guessing.
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

  const data = usage.data as AiUsageSummary | undefined;

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

      {usage.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{usage.error}</AlertDescription>
        </Alert>
      )}

      {usage.loading ? (
        <Skeleton className="h-60 w-full" />
      ) : data === undefined ? (
        <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
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

          <Card>
            <CardHeader>
              <CardTitle>By model</CardTitle>
              <CardDescription>
                {data.sampledCalls} call(s) sampled · {new Date(data.sampledAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.byModel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls in the sample.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byModel.map((row) => (
                      <TableRow key={`${row.provider}/${row.model}`}>
                        <TableCell>
                          <div className="font-mono text-sm">{row.model}</div>
                          <div className="text-xs text-muted-foreground">{row.provider}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.calls}</TableCell>
                        <TableCell className="text-right text-sm">{tokens(row)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{spend(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By day</CardTitle>
              <CardDescription>Daily activity within the sample window</CardDescription>
            </CardHeader>
            <CardContent>
              {data.byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls in the sample.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byDay.map((row) => (
                      <TableRow key={row.day}>
                        <TableCell className="font-mono text-sm">{row.day}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.calls}</TableCell>
                        <TableCell className="text-right text-sm">{tokens(row)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{spend(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By feature</CardTitle>
              <CardDescription>Which surfaces issued the requests</CardDescription>
            </CardHeader>
            <CardContent>
              {data.byFeature.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls in the sample.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byFeature.map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell className="font-mono text-sm">{row.feature}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.calls}</TableCell>
                        <TableCell className="text-right text-sm">{tokens(row)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{spend(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageBody>
  );
}
