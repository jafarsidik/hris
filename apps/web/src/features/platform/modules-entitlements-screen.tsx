'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { ApplicationSummary, ModuleSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';

export function ModulesEntitlementsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const applications = useIamLoad(() => platformApi.listRegistryApplications(), []);
  const modules = useIamLoad(() => platformApi.listRegistryModules(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const appRows = applications.data ?? [];
  const moduleRows = modules.data ?? [];
  const errorText = applications.error ?? modules.error;

  const byApp = new Map<string, ModuleSummary[]>();
  for (const module of moduleRows) {
    const bucket = byApp.get(module.applicationId) ?? [];
    bucket.push(module);
    byApp.set(module.applicationId, bucket);
  }

  return (
    <PageBody>
      <PageHeader
        title="Modules & Entitlements"
        description="Modules owned by each application — the functional areas that register resources."
      />

      {errorText !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{errorText}</AlertDescription>
        </Alert>
      )}

      {applications.loading || modules.loading ? (
        <Skeleton className="h-60 w-full" />
      ) : appRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications are registered yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Modules by application</CardTitle>
            <CardDescription>
              {moduleRows.length} module{moduleRows.length === 1 ? '' : 's'} across {appRows.length}{' '}
              application{appRows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appRows.map((app: ApplicationSummary) => {
              const mods = byApp.get(app.id) ?? [];
              return (
                <div key={app.id} className="mb-5 border rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{app.name}</span>{' '}
                      <span className="font-mono text-xs text-muted-foreground">{app.key}</span>
                    </div>
                    <Badge variant={app.isActive ? 'success' : 'secondary'}>
                      {app.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                  {mods.length === 0 ? (
                    <p className="text-sm text-muted-foreground ml-2">No modules registered.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Sort order</TableHead>
                          <TableHead>State</TableHead>
                          {canManage && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mods.map((m: ModuleSummary) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-sm">{m.key}</TableCell>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {m.sortOrder}
                            </TableCell>
                            <TableCell>
                              <Badge variant={m.isActive ? 'success' : 'secondary'}>
                                {m.isActive ? 'ACTIVE' : 'INACTIVE'}
                              </Badge>
                            </TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" disabled>
                                  Edit
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
