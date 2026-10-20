'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Switch } from '@/components/ui/switch';
import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import { Check, Copy, RefreshCw } from 'lucide-react';

import { formatTimestamp } from './client-table-config';
import type { DeveloperApiClient } from './developer-types';
import { getDevelopers } from './index';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CopyButton({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Copy client id"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </Button>
  );
}

/** The state filter, labelled the way the State column is. */
const STATE_FILTER: readonly DataTableFilter<DeveloperApiClient>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
    ],
  },
];

const CREDENTIALS_SEARCH_TEXT = (row: DeveloperApiClient): string =>
  [row.name, row.clientId, row.description ?? ''].join(' ');

/**
 * API Credentials: the credential material behind every API client — when keys were
 * issued, which clients sit unused, whether they are active, and a rotation flow
 * that reveals the new secret exactly once. Distinct from /setup/api/clients, which
 * CRUDs clients and their scopes.
 */
export function CredentialsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getDevelopers();
  const canUpdate = useCan('api-client.update');

  /*
   * Load failures belong to the table, which owns the error state and the retry button;
   * mutation failures keep the alert below the header, so a rejected change never takes
   * the list away with it.
   */
  const [loadError, setLoadError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [rows, setRows] = useState<readonly DeveloperApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  /*
   * Rotate replaces the secret and disable cuts the client off, so both are gated behind
   * a dialog that names the client and the consequence, with the failure surfaced in the
   * dialog. Enabling is the safe direction and stays a single click.
   */
  const [rotateTarget, setRotateTarget] = useState<DeveloperApiClient | null>(null);
  const [disableTarget, setDisableTarget] = useState<DeveloperApiClient | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setRows(await repository.listClients());
    } catch (cause) {
      setLoadError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((row) => row.isActive).length;
  const neverUsed = rows.filter((row) => row.lastUsedAt === null).length;

  async function confirmRotate(): Promise<void> {
    if (rotateTarget === null) {
      return;
    }
    setBusyId(rotateTarget.id);
    setPending(true);
    setConfirmError(undefined);
    try {
      await repository.rotateClient(rotateTarget.id);
      setNotice(`New secret issued for "${rotateTarget.name}".`);
      setRotateTarget(null);
      await load();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setPending(false);
      setBusyId(null);
    }
  }

  async function confirmDisable(): Promise<void> {
    if (disableTarget === null) {
      return;
    }
    setBusyId(disableTarget.id);
    setPending(true);
    setConfirmError(undefined);
    try {
      await repository.updateClient(disableTarget.id, { isActive: false });
      setNotice(`Client "${disableTarget.name}" deactivated.`);
      setDisableTarget(null);
      await load();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setPending(false);
      setBusyId(null);
    }
  }

  async function enable(row: DeveloperApiClient): Promise<void> {
    setBusyId(row.id);
    try {
      await repository.updateClient(row.id, { isActive: true });
      setNotice(`Client "${row.name}" activated.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<DeveloperApiClient>[] = [
    {
      id: 'client',
      header: 'Client',
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description !== null && (
            <div className="text-xs text-muted-foreground">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      id: 'clientId',
      header: 'Client ID',
      headerClassName: 'font-mono text-sm',
      sortValue: (row) => row.clientId,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="font-mono text-xs truncate w-48">{row.clientId}</div>
          <CopyButton value={row.clientId} />
        </div>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      align: 'right',
      sortValue: (row) => row.createdAt,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => formatTimestamp(row.createdAt),
    },
    {
      id: 'lastUsed',
      header: 'Last used',
      align: 'right',
      sortValue: (row) => row.lastUsedAt ?? '',
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => formatTimestamp(row.lastUsedAt),
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (row) => (row.isActive ? 'Active' : 'Inactive'),
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'secondary'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  if (canUpdate) {
    columns.push({
      id: 'actions',
      header: 'Credential actions',
      align: 'right',
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      /*
       * Wider than the default pinned cell because the row carries a switch next to the
       * rotate button; the sticky background and border come from the shared class and
       * `w-56` only overrides the width tailwind-merge would otherwise keep at w-10.
       */
      cellClassName: `${PINNED_ACTIONS_CELL_CLASS} w-56`,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.isActive && (
            <Button
              variant="outline"
              size="sm"
              disabled={busyId === row.id}
              onClick={() => {
                setConfirmError(undefined);
                setRotateTarget(row);
              }}
            >
              Rotate secret
            </Button>
          )}
          <Switch
            checked={row.isActive}
            disabled={busyId === row.id}
            onCheckedChange={(next) => {
              if (next) {
                void enable(row);
              } else {
                setConfirmError(undefined);
                setDisableTarget(row);
              }
            }}
          />
        </div>
      ),
    });
  }

  return (
    <PageBody>
      <PageHeader
        title="API Credentials"
        description="API key material across clients — issued age, last use, active state and rotation."
        actions={
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className="mr-1 size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {error !== undefined && (
        <Alert>
          <AlertTitle>Update failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-4">
        <Stat label="Clients" value={String(rows.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Never used" value={String(neverUsed)} />
        <Stat label="Secret header" value="X-Api-Key" />
      </div>

      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={STATE_FILTER}
        searchable
        searchText={CREDENTIALS_SEARCH_TEXT}
        searchPlaceholder="Search by name, client id or description…"
        selectable={false}
        status={loading ? 'loading' : loadError !== undefined ? 'error' : 'ready'}
        errorCopy={loadError}
        onRetry={() => void load()}
        emptyTitle="No API clients have been created yet"
        emptyDescription="Create an API client to issue its key; it appears here with its credential state."
        noResultsTitle="No API clients match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every client."
      />

      <ConfirmDialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRotateTarget(null);
            setConfirmError(undefined);
          }
        }}
        title={
          rotateTarget !== null ? `Rotate the secret for ${rotateTarget.name}?` : 'Rotate secret?'
        }
        description="The current secret stops working immediately."
        confirmLabel="Rotate secret"
        tone="destructive"
        pending={pending}
        error={confirmError}
        onConfirm={() => void confirmRotate()}
      />

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisableTarget(null);
            setConfirmError(undefined);
          }
        }}
        title={disableTarget !== null ? `Disable ${disableTarget.name}?` : 'Disable client?'}
        description="The client stops authenticating until it is enabled again; its secret is kept."
        confirmLabel="Disable"
        tone="destructive"
        pending={pending}
        error={confirmError}
        onConfirm={() => void confirmDisable()}
      />
    </PageBody>
  );
}
