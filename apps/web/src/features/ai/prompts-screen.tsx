'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontalIcon, PencilIcon, Plus, Trash2Icon } from 'lucide-react';
import type { AiPromptSummary } from '@hris/shared-types';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

interface PromptDraft {
  key: string;
  name: string;
  content: string;
  isEnabled: boolean;
}

/**
 * The per-row actions menu for prompt versions.
 *
 * The screen's previous controls were bare "Edit" and "Delete" buttons in the last
 * column: they named no record, so a reader scanning a row had to work out which
 * version a button belonged to, and "Delete" wrote straight through on a single
 * click behind a `window.confirm`. Moving them into a menu gives the trigger an
 * accessible name that includes the key and version, keeps the row uncluttered, and
 * — with `ConfirmDialog` on the screen — lets the destructive direction be confirmed
 * while the safe one stays a single click.
 *
 * Items are omitted entirely when the permission is absent, so a reader without
 * `ai.update` sees no Edit rather than a control that silently does nothing.
 */
function PromptRowMenu({
  row,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  readonly row: AiPromptSummary;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (row: AiPromptSummary) => void;
  readonly onDelete: (row: AiPromptSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${row.key} v${row.version}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <PencilIcon aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
            <Trash2Icon aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The prompts table's columns.
 *
 * The actions column is omitted entirely when the reader has neither `ai.update` nor
 * `ai.delete`, rather than rendering a column of controls that do nothing — the same
 * rule the users directory follows.
 */
function buildPromptColumns({
  canUpdate,
  canDelete,
  onEdit,
  onToggleEnabled,
  onDelete,
}: {
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (row: AiPromptSummary) => void;
  readonly onToggleEnabled: (row: AiPromptSummary, enabled: boolean) => void;
  readonly onDelete: (row: AiPromptSummary) => void;
}): readonly DataTableColumn<AiPromptSummary>[] {
  const columns: DataTableColumn<AiPromptSummary>[] = [
    {
      id: 'key',
      header: 'Key',
      sortValue: (row) => row.key,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.key,
    },
    {
      id: 'version',
      header: 'Version',
      align: 'right',
      sortValue: (row) => row.version,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => row.version,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (row) => row.name ?? '',
      cellClassName: 'text-sm',
      cell: (row) => row.name ?? '—',
    },
    {
      id: 'content',
      header: 'Content',
      sortValue: (row) => row.content,
      cellClassName: 'max-w-72 truncate text-muted-foreground text-sm',
      cell: (row) => row.content,
    },
    {
      id: 'live',
      header: 'Live',
      sortValue: (row) => (row.isEnabled ? 1 : 0),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.isEnabled}
            disabled={!canUpdate}
            onCheckedChange={(next) => void onToggleEnabled(row, next)}
          />
          {row.isEnabled && <Badge variant="success">LIVE</Badge>}
        </div>
      ),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <PromptRowMenu
          row={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    });
  }

  return columns;
}

/**
 * Prompts: versioned system-prompt templates. Enabling a version retires its siblings,
 * and the gateway picks up the enabled version for its key on the next ask — the
 * built-in prompt stays in effect until a key has an enabled version.
 */
export function PromptsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const prompts = useIamLoad(() => aiApi.listPrompts(), []);
  const canManage = useCan('ai.create');
  const canUpdate = useCan('ai.update');
  const canDelete = useCan('ai.delete');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft>({
    key: '',
    name: '',
    content: '',
    isEnabled: false,
  });
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<AiPromptSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const rows = prompts.data ?? [];

  const open = (row: AiPromptSummary | null) => {
    setEditingId(row?.id ?? null);
    setDraft(
      row === null
        ? { key: '', name: '', content: '', isEnabled: false }
        : { key: row.key, name: row.name ?? '', content: row.content, isEnabled: row.isEnabled },
    );
    setError(undefined);
    setDialogOpen(true);
  };

  const save = useCallback(async () => {
    if (draft.content.trim() === '') {
      setError('Content is required.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      if (editingId === null) {
        if (draft.key.trim() === '') {
          setError('Key is required.');
          setPending(false);
          return;
        }
        await aiApi.createPrompt({
          key: draft.key.trim(),
          name: draft.name.trim() === '' ? null : draft.name.trim(),
          content: draft.content,
          isEnabled: draft.isEnabled,
        });
        setNotice(`New version of "${draft.key.trim()}" created.`);
      } else {
        await aiApi.updatePrompt(editingId, {
          name: draft.name.trim() === '' ? null : draft.name.trim(),
          content: draft.content,
          isEnabled: draft.isEnabled,
        });
        setNotice('Prompt version saved.');
      }
      setDialogOpen(false);
      prompts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }, [draft, editingId, prompts]);

  const confirmDelete = async () => {
    if (deleting === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await aiApi.removePrompt(deleting.id);
      toast({
        title: 'Prompt version deleted',
        description: `${deleting.key} v${deleting.version} was removed.`,
        variant: 'success',
      });
      setDeleting(null);
      prompts.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  };

  const setEnabled = async (row: AiPromptSummary, enabled: boolean) => {
    try {
      await aiApi.updatePrompt(row.id, { isEnabled: enabled });
      setNotice(
        enabled
          ? `${row.key} v${row.version} is now live.`
          : `${row.key} v${row.version} disabled.`,
      );
      prompts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Prompts"
        description="Versioned prompt templates; the enabled version replaces the built-in prompt for its key."
        actions={
          canManage && (
            <Button size="sm" onClick={() => open(null)}>
              <Plus className="mr-1 size-4" aria-hidden />
              New version
            </Button>
          )
        }
      />
      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildPromptColumns({
          canUpdate,
          canDelete,
          onEdit: open,
          onToggleEnabled: setEnabled,
          onDelete: (row) => {
            setDeleteError(undefined);
            setDeleting(row);
          },
        })}
        searchable
        searchText={(row) => [row.key, row.name ?? '', row.content].join(' ')}
        searchPlaceholder="Search by key, name or content…"
        selectable={false}
        status={prompts.loading ? 'loading' : prompts.error !== undefined ? 'error' : 'ready'}
        errorCopy={prompts.error}
        onRetry={() => prompts.reload()}
        emptyTitle="No prompt versions yet"
        emptyDescription="The gateway uses its built-in prompt."
        noResultsTitle="No prompt versions match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every version."
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={deleting !== null ? `Delete ${deleting.key} v${deleting.version}?` : ''}
        description={
          deleting === null ? (
            'This version is removed permanently.'
          ) : (
            <>
              This version is removed permanently. Other versions of {deleting.key} are unaffected;
              if this was the live version, the gateway falls back to the built-in prompt for the
              key until another version is enabled.
            </>
          )
        }
        confirmLabel="Delete"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId === null ? 'New prompt version' : 'Edit version'}</DialogTitle>
            <DialogDescription>
              Each save stores a version for the key; enabling one version retires the others.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormField label="Key" htmlFor="prompt-key" required errorId="prompt-key-error">
              <Input
                id="prompt-key"
                placeholder="policy-faq.system"
                value={draft.key}
                disabled={editingId !== null}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, key: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField label="Name" htmlFor="prompt-name" errorId="prompt-name-error">
              <Input
                id="prompt-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField
              label="Content"
              htmlFor="prompt-content"
              required
              errorId="prompt-content-error"
            >
              <Textarea
                id="prompt-content"
                rows={8}
                value={draft.content}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, content: event.currentTarget.value }))
                }
              />
            </FormField>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Live (use for new requests)</span>
              <Switch
                checked={draft.isEnabled}
                onCheckedChange={(next) => setDraft((current) => ({ ...current, isEnabled: next }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <FormSubmitButton pending={pending}>
                {editingId === null ? 'Create version' : 'Save changes'}
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
