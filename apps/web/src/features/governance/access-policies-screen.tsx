'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
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

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { getIam } from '@/features/iam';

interface PermissionRow {
  readonly resource: string;
  readonly action: string;
}

export function AccessPoliciesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('registry.manage');
  const policies = useIamLoad(() => getIam().listPermissions(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  // Group capabilities by resource so the screen reads as an access policy
  // catalogue: what can be done, and on which resource.
  const byResource = new Map<string, string[]>();
  const rows = (policies.data ?? []) as readonly PermissionRow[];
  for (const row of rows) {
    const actions = byResource.get(row.resource) ?? [];
    if (!actions.includes(row.action)) {
      actions.push(row.action);
    }
    byResource.set(row.resource, actions);
  }
  const grouped = Array.from(byResource.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <PageBody>
      <PageHeader
        title="Access Policies"
        description="Capability catalogue: each resource and the actions that can be granted on it."
      />

      {policies.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{policies.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resource policies</CardTitle>
          <CardDescription>
            {policies.loading
              ? 'Loading…'
              : `${rows.length} capability${rows.length === 1 ? '' : 's'} across ${grouped.length} resource${grouped.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No capabilities defined" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Allowed actions</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([resource, actions]) => (
                  <TableRow key={resource}>
                    <TableCell className="font-medium">{resource}</TableCell>
                    <TableCell className="font-mono text-sm">{actions.join(', ')}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => {}}>
                          Edit grants
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
