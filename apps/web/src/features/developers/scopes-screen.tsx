'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import { platformApi } from '@/features/platform/platform-api';

/**
 * One row of the scope catalogue.
 *
 * The catalogue is keyed by the scope string itself (`resource.action`), which is what the
 * shared table needs as `id`; carrying it as a field of the row keeps the mapping in one
 * place instead of a spread at the call site.
 */
interface ScopeRow {
  readonly id: string;
  readonly scope: string;
  readonly resource: string;
  readonly action: string;
  readonly description: string | null;
  readonly custom: boolean;
}

/**
 * API Scopes: the grantable `resource.action` scope vocabulary exposed by the
 * resource registry — what machine credentials can be scoped down to when an API
 * client is created or edited.
 */
export function ScopesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canView = useCan('registry.view');

  const [error, setError] = useState<string | undefined>();
  const [rows, setRows] = useState<readonly ScopeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const resources = await platformApi.listRegistryResources();
      const scopes: ScopeRow[] = [];
      for (const resource of resources) {
        for (const action of resource.actions ?? []) {
          const scope = `${resource.key}.${action.action}`;
          scopes.push({
            id: scope,
            scope,
            resource: resource.name,
            action: action.action,
            description: action.description,
            custom: action.isCustom,
          });
        }
      }
      scopes.sort((a, b) => a.scope.localeCompare(b.scope));
      setRows(scopes);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: readonly DataTableColumn<ScopeRow>[] = [
    {
      id: 'scope',
      header: 'Scope',
      headerClassName: 'font-mono text-sm',
      sortValue: (row) => row.scope,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.scope,
    },
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (row) => row.resource,
      cell: (row) => row.resource,
    },
    {
      id: 'action',
      header: 'Action',
      headerClassName: 'font-mono text-sm',
      sortValue: (row) => row.action,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.action,
    },
    {
      id: 'description',
      header: 'Description',
      sortValue: (row) => row.description ?? '',
      cellClassName: 'text-muted-foreground text-sm',
      cell: (row) => row.description ?? '—',
    },
    {
      id: 'origin',
      header: 'Origin',
      sortValue: (row) => (row.custom ? 'Custom' : 'Built-in'),
      cell: (row) => (
        <Badge variant={row.custom ? 'outline' : 'secondary'}>
          {row.custom ? 'Custom' : 'Built-in'}
        </Badge>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="API Scopes"
        description="Grantable scopes for machine access — each scope is a registered resource action."
      />

      {/*
        The catalogue is narrow by design — five columns of scope strings — so the table
        keeps the max-w-4xl measure the hand-rolled card had, without the card around it:
        the shared table brings its own.
      */}
      <div className="max-w-4xl">
        <HrisDataTable
          rows={rows}
          columns={columns}
          searchable
          searchText={(row) =>
            [row.scope, row.resource, row.action, row.description ?? ''].join(' ')
          }
          searchPlaceholder="Search scopes…"
          selectable={false}
          status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
          errorCopy={error}
          onRetry={() => void load()}
          emptyTitle="No grantable scopes yet — register resource actions to create scopes."
          noResultsTitle="No scopes match this filter"
          noResultsDescription="Try a different search, or clear the filters to see the whole catalogue."
        />
      </div>

      {!canView && (
        <Alert>
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            You don't have permission to read the registry; contact your administrator to manage
            scopes.
          </AlertDescription>
        </Alert>
      )}
    </PageBody>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}
