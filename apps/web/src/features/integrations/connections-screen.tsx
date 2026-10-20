'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INTEGRATION_KINDS, INTEGRATION_STATUSES } from '@hris/shared-types';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { apiIntegrationRepository } from '@/features/integrations/integration-api';
import type { IntegrationConnectionTestResult, IntegrationSummary } from './integration-types';
import { ConnectionRowMenu } from './connection-row-menu';
import { ApiRequestError } from '@/lib/api/http-client';

const CONNECTIONS_VIEWS_STORAGE_KEY = 'hris:integrations:connections:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

function statusVariant(
  status: IntegrationSummary['status'],
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (status === 'CONNECTED') return 'success';
  if (status === 'ERROR') return 'destructive';
  if (status === 'DISCONNECTED') return 'warning';
  return 'secondary';
}

/** The free text a row matches against; every column a reader would search by. */
const CONNECTION_SEARCH_TEXT = (connection: IntegrationSummary): string =>
  [
    connection.name,
    connection.key,
    connection.kind,
    connection.provider,
    connection.status,
    connection.lastMessage ?? '',
  ].join(' ');

/**
 * The filters the toolbar shows.
 *
 * The status and kind vocabularies are always offered, unioned with whatever the rows
 * actually carry — the same rule the users table follows, so "show me the failing
 * connections" cannot disappear at exactly the moment there are none.
 */
function buildConnectionsFilters(
  rows: readonly IntegrationSummary[],
): readonly DataTableFilter<IntegrationSummary>[] {
  const presentStatuses = new Set<string>([
    ...INTEGRATION_STATUSES,
    ...rows.map((row) => row.status),
  ]);
  const statusOptions = [...presentStatuses].map((status) => ({ value: status, label: status }));

  const presentKinds = new Set<string>([...INTEGRATION_KINDS, ...rows.map((row) => row.kind)]);
  const kindOptions = [...presentKinds].map((kind) => ({ value: kind, label: kind }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (row) => row.status,
      options: statusOptions,
    },
    {
      kind: 'select',
      id: 'kind',
      label: 'Kind',
      placeholder: 'All kinds',
      advanced: true,
      getValue: (row) => row.kind,
      options: kindOptions,
    },
  ];
}

const withStatus = (status: IntegrationSummary['status']) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the connections list ships with; the first is the default. */
const CONNECTION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All connections',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'connected', name: 'Connected', builtIn: true, state: withStatus('CONNECTED') },
  { id: 'errors', name: 'Errors', builtIn: true, state: withStatus('ERROR') },
  { id: 'disconnected', name: 'Disconnected', builtIn: true, state: withStatus('DISCONNECTED') },
];

/**
 * The columns, in the order the screen has always shown them.
 *
 * The enable switch is the one control that writes from a cell: enabling is the safe
 * direction and applies straight away, while disabling stops every delivery routed
 * through the connection, so the screen gates that direction behind a confirm dialog
 * — the same split the users screen draws between activating and suspending.
 */
function buildConnectionsColumns({
  canManage,
  busy,
  onTest,
  onToggle,
}: {
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly onTest: (connection: IntegrationSummary) => void;
  readonly onToggle: (connection: IntegrationSummary) => void;
}): readonly DataTableColumn<IntegrationSummary>[] {
  return [
    {
      id: 'connection',
      header: 'Connection',
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      sortValue: (row) => row.kind,
      cell: (row) => <Badge variant="outline">{row.kind}</Badge>,
    },
    {
      id: 'provider',
      header: 'Provider',
      sortValue: (row) => row.provider,
      cellClassName: 'text-sm',
      cell: (row) => row.provider,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => (
        <div>
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
          {row.lastMessage !== null && (
            <div className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
              {row.lastMessage}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'lastChecked',
      header: 'Last checked',
      sortValue: (row) => row.lastCheckedAt ?? '',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.lastCheckedAt ?? '—',
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (row) => (
        <Switch
          checked={row.isEnabled}
          disabled={!canManage}
          onCheckedChange={() => onToggle(row)}
        />
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <ConnectionRowMenu connection={row} busy={busy} canManage={canManage} onTest={onTest} />
      ),
    },
  ];
}

/**
 * Connections: the outbound-connection overview (what is connected, to where, is it
 * healthy). Configuration lives behind each connection's detail page; this screen is the
 * list view an operator scans before opening one.
 */
export function ConnectionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const canManage = useCan('integration.manage');

  const [rows, setRows] = useState<readonly IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [testResult, setTestResult] = useState<{
    name: string;
    result: IntegrationConnectionTestResult;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState<IntegrationSummary | null>(null);
  const [disablePending, setDisablePending] = useState(false);
  const [disableError, setDisableError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setRows(await apiIntegrationRepository.listIntegrations());
    } catch (cause) {
      setLoadError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = async (integration: IntegrationSummary) => {
    setActionError(undefined);
    setBusy(true);
    try {
      const result = await apiIntegrationRepository.testIntegration(integration.id);
      setTestResult({ name: integration.name, result });
      setRows((current) =>
        current.map((row) =>
          row.id === integration.id
            ? {
                ...row,
                status: result.status,
                lastCheckedAt: result.checkedAt,
                lastMessage: result.message,
              }
            : row,
        ),
      );
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Writes the new enabled state and reports the failure instead of throwing, so the
   * caller decides where the reason goes: the page-level panel for the direct enable
   * path, the confirm dialog for the disable path.
   */
  const applyToggle = async (
    integration: IntegrationSummary,
    isEnabled: boolean,
  ): Promise<string | undefined> => {
    try {
      await apiIntegrationRepository.updateIntegration(integration.id, { isEnabled });
      setRows((current) =>
        current.map((row) => (row.id === integration.id ? { ...row, isEnabled } : row)),
      );
      toast({
        title: isEnabled ? 'Connection enabled' : 'Connection disabled',
        description: isEnabled
          ? `${integration.name} is accepting deliveries again.`
          : `${integration.name} will not receive deliveries until it is re-enabled.`,
        variant: 'success',
      });
    } catch (cause) {
      return messageOf(cause);
    }
    return undefined;
  };

  function requestToggle(integration: IntegrationSummary): void {
    if (integration.isEnabled) {
      setDisableError(undefined);
      setDisabling(integration);
      return;
    }
    setActionError(undefined);
    void applyToggle(integration, true).then((error) => {
      if (error !== undefined) {
        setActionError(error);
      }
    });
  }

  async function confirmDisable(): Promise<void> {
    if (disabling === null) return;
    setDisablePending(true);
    setDisableError(undefined);
    const error = await applyToggle(disabling, false);
    if (error !== undefined) {
      // Keep the dialog open with the reason, so the reader can retry or back out.
      setDisableError(error);
    } else {
      setDisabling(null);
    }
    setDisablePending(false);
  }

  return (
    <PageBody>
      <PageHeader
        title="Connections"
        description="Reusable outbound connections — transport endpoints the platform delivers through."
      />

      {actionError !== undefined && <ErrorPanel error={actionError} />}
      {testResult !== null && (
        <Alert variant={testResult.result.ok ? 'success' : 'destructive'}>
          <AlertTitle>
            {testResult.name}: {testResult.result.ok ? 'connected' : 'failed'}
          </AlertTitle>
          <AlertDescription>
            {testResult.result.message} ({testResult.result.checkedAt})
          </AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildConnectionsColumns({
          canManage,
          busy,
          onTest: (row) => void test(row),
          onToggle: requestToggle,
        })}
        filters={buildConnectionsFilters(rows)}
        searchable
        searchText={CONNECTION_SEARCH_TEXT}
        searchPlaceholder="Search by name, key, provider or status…"
        selectable={false}
        views={{
          builtIn: CONNECTION_BUILT_IN_VIEWS,
          storageKey: CONNECTIONS_VIEWS_STORAGE_KEY,
        }}
        status={loading ? 'loading' : loadError !== undefined ? 'error' : 'ready'}
        errorCopy={loadError}
        onRetry={load}
        emptyTitle="No connections configured"
        emptyDescription="Connections registered during integration setup appear here."
        noResultsTitle="No connections match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every connection."
      />

      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisabling(null);
            setDisableError(undefined);
          }
        }}
        title={disabling !== null ? `Disable ${disabling.name}?` : 'Disable connection?'}
        description={
          disabling !== null ? (
            <>
              Every delivery routed through {disabling.name} ({disabling.key}) is held while the
              connection is disabled. Re-enabling it resumes delivery; nothing already recorded is
              lost.
            </>
          ) : (
            'Every delivery routed through this connection is held while it is disabled.'
          )
        }
        confirmLabel="Disable"
        tone="destructive"
        pending={disablePending}
        error={disableError}
        onConfirm={() => {
          if (disabling !== null) {
            void confirmDisable();
          }
        }}
      />
    </PageBody>
  );
}
