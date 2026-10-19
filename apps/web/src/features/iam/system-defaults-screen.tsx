'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { SYSTEM_SETTING_DEFAULTS } from '@hris/shared-types';

interface DefaultRow {
  readonly group: string;
  readonly key: string;
  readonly valueType: string;
  readonly default: string;
  readonly current: string | null;
  readonly status: 'default' | 'changed' | 'unset';
}

/**
 * System Defaults: the platform-wide setting catalogue — what each setting defaults
 * to, what this company has set, and where the tenant has drifted from the default.
 */
export function SystemDefaultsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canView = useCan('setting.view');

  const settings = useIamLoad(() => getIam().listSettings(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const current = new Map((settings.data ?? []).map((row) => [row.key, row.value ?? null]));

  const rows: DefaultRow[] = [];
  for (const def of SYSTEM_SETTING_DEFAULTS) {
    const value = current.get(def.key) ?? null;
    let status: DefaultRow['status'] = 'default';
    if (value === null) status = 'unset';
    else if (String(value) !== String(def.value)) status = 'changed';
    rows.push({
      group: def.group,
      key: def.key,
      valueType: def.valueType,
      default: mask(def.valueType, def.value),
      current: value === null ? null : mask(def.valueType, value),
      status,
    });
  }
  rows.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));

  const changed = rows.filter((row) => row.status === 'changed').length;

  return (
    <PageBody>
      <PageHeader
        title="System Defaults"
        description="Company and platform default values — defaults versus what this company has set."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={settings.loading}
            onClick={() => settings.reload()}
          >
            Refresh
          </Button>
        }
      />

      {settings.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{settings.error}</AlertDescription>
        </Alert>
      )}

      {settings.loading ? (
        <Skeleton className="h-60 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Card>
              <CardHeader className="pb-1.5">
                <CardDescription>Settings in catalogue</CardDescription>
                <CardTitle className="text-xl tabular-nums">{String(rows.length)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1.5">
                <CardDescription>Customized from default</CardDescription>
                <CardTitle className="text-xl tabular-nums">{String(changed)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>Setting catalogue</CardTitle>
              <CardDescription>
                {rows.length} system setting{rows.length === 1 ? '' : 's'}
                {changed > 0 ? ` · ${changed} customized` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState title="No settings defined" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead className="font-mono text-sm">Key</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Current value</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="text-muted-foreground text-sm">{row.group}</TableCell>
                        <TableCell className="font-mono text-sm">{row.key}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-sm">
                          {row.valueType}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.default}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {row.current ?? '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              row.status === 'changed'
                                ? 'warning'
                                : row.status === 'unset'
                                  ? 'secondary'
                                  : 'success'
                            }
                          >
                            {row.status === 'changed'
                              ? 'Customized'
                              : row.status === 'unset'
                                ? 'Not set'
                                : 'Default'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {!canView && (
            <Alert>
              <AlertTitle>Read-only view</AlertTitle>
              <AlertDescription>
                You don't have permission to read system settings; contact your administrator.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </PageBody>
  );
}

function mask(valueType: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (valueType === 'BOOLEAN') {
    return String(value);
  }
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
