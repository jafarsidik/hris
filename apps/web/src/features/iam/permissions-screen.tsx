'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';

export function PermissionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const list = useIamLoad(() => repository.listPermissions(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const grouped = new Map<string, string[]>();
  for (const permission of list.data ?? []) {
    const actions = grouped.get(permission.resource) ?? [];
    actions.push(permission.action);
    grouped.set(permission.resource, actions);
  }

  return (
    <PageBody>
      <PageHeader
        title="Permissions"
        description="The fine-grained permissions that roles grant. Editing happens per role."
      />
      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <ErrorPanel error={list.error} onRetry={() => list.reload()} />
      ) : grouped.size === 0 ? (
        <EmptyState
          title="No permissions are defined"
          description="Permissions appear here once resources and actions are registered."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([resource, actions]) => (
              <div
                key={resource}
                className="flex flex-col gap-2 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{resource}</span>
                  <Badge variant="secondary">{actions.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {actions.sort().map((action) => (
                    <Badge key={action} variant="outline" className="font-mono text-xs">
                      {action}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </PageBody>
  );
}
