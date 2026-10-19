'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { TenantSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request could not be completed.';
}

function bytesLabel(value: number | null): string {
  if (value === null) {
    return '∞';
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

export function TenantsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tenants = useIamLoad(() => tenantsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const toggleSuspend = useCallback(
    async (tenant: TenantSummary) => {
      setError(undefined);
      try {
        await (tenant.status === 'SUSPENDED'
          ? tenantsApi.activate(tenant.id)
          : tenantsApi.suspend(tenant.id));
        setNotice('Tenant status updated.');
        tenants.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [tenants],
  );

  const changePlan = useCallback(
    async (tenant: TenantSummary, plan: string) => {
      setError(undefined);
      try {
        await tenantsApi.update(tenant.id, { plan });
        setNotice('Plan updated.');
        tenants.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [tenants],
  );

  const rows = tenants.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Tenant Management"
        description="Companies on this platform, their plan, quota and lifecycle."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            {tenants.loading ? 'Loading…' : `${rows.length} tenant${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No tenants" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground">{tenant.code}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tenant.plan}
                        onValueChange={(value) => {
                          if (typeof value === 'string') {
                            void changePlan(tenant, value);
                          }
                        }}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'TRIAL'].map((plan) => (
                            <SelectItem key={plan} value={plan}>
                              {plan}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-mono">
                      {tenant.userCount}
                      {tenant.seatLimit !== null ? ` / ${tenant.seatLimit}` : ''}
                    </TableCell>
                    <TableCell className="font-mono">
                      {bytesLabel(tenant.storageUsedBytes)} / {bytesLabel(tenant.storageQuotaBytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleSuspend(tenant)}
                        >
                          {tenant.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
