'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { TenantSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantsApi } from '@/features/tenants/tenants-api';

function bytesLabel(value: number | null): string {
  if (value === null) {
    return '∞';
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

function percent(used: number | null, limit: number | null): number {
  if (used === null || limit === null || limit === 0) {
    return 0;
  }
  return Math.min(100, Math.round((used / limit) * 100));
}

export function UsageQuotasScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tenants = useIamLoad(() => tenantsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = (tenants.data ?? []) as TenantSummary[];

  return (
    <PageBody>
      <PageHeader
        title="Usage & Quotas"
        description="Per-tenant consumption against seat and storage quotas."
      />

      {tenants.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{tenants.error}</AlertDescription>
        </Alert>
      )}

      {tenants.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No tenants" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tenant quotas</CardTitle>
            <CardDescription>
              {rows.length} tenant{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const userPct = percent(t.userCount, t.seatLimit);
                  const storagePct = percent(t.storageUsedBytes, t.storageQuotaBytes);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {t.userCount}
                        {t.seatLimit !== null ? ` / ${t.seatLimit}` : ''}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {bytesLabel(t.storageUsedBytes)}
                        {t.storageQuotaBytes !== null
                          ? ` / ${bytesLabel(t.storageQuotaBytes)}`
                          : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          <Progress value={Math.max(userPct, storagePct)} />
                          <span className="font-mono text-xs">
                            {Math.max(userPct, storagePct)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardDescription className="mt-3 text-sm text-muted-foreground">
            Utilization shows the higher of user-seat and storage usage against the tenant's quota.{' '}
            {canManage ? 'Quota limits are managed on the Tenants screen.' : ''}
          </CardDescription>
        </Card>
      )}
    </PageBody>
  );
}
