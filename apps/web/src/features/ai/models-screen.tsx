'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import type { AiModelSummary, CreateAiModelInput } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import {
  MODEL_BUILT_IN_VIEWS,
  MODEL_SEARCH_TEXT,
  MODEL_VIEWS_STORAGE_KEY,
  buildModelColumns,
  buildModelFilters,
} from '@/features/ai/model-table-config';
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

interface ModelDraft {
  key: string;
  name: string;
  provider: string;
  contextWindow: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  isDefault: boolean;
  isEnabled: boolean;
}

const EMPTY_DRAFT: ModelDraft = {
  key: '',
  name: '',
  provider: 'openai-compatible',
  contextWindow: '',
  inputPricePerMillion: '',
  outputPricePerMillion: '',
  isDefault: false,
  isEnabled: true,
};

function toInput(draft: ModelDraft): CreateAiModelInput | { error: string } {
  const number = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
  };
  const window = draft.contextWindow.trim() === '' ? null : Number(draft.contextWindow);
  const input = number(draft.inputPricePerMillion);
  const output = number(draft.outputPricePerMillion);
  if (
    (window !== null && !Number.isInteger(window)) ||
    Number.isNaN(window as number) ||
    Number.isNaN(input) ||
    Number.isNaN(output)
  ) {
    return { error: 'Context window must be a whole number; prices must be zero or more.' };
  }
  return {
    key: draft.key.trim(),
    name: draft.name.trim(),
    provider: draft.provider.trim(),
    contextWindow: window,
    inputPricePerMillion: input,
    outputPricePerMillion: output,
    isDefault: draft.isDefault,
    isEnabled: draft.isEnabled,
  };
}

/**
 * Models: the tenant's model catalogue. Pricing here feeds Usage & Cost, and the single
 * default-enabled model is what the gateway uses when an agent names no model.
 */
export function ModelsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const models = useIamLoad(() => aiApi.listModels(), []);
  const canManage = useCan('ai.create');
  const canUpdate = useCan('ai.update');
  const canDelete = useCan('ai.delete');
  const { toast } = useToast();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModelDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<AiModelSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const rows = (models.data ?? []) as readonly AiModelSummary[];

  const open = (row: AiModelSummary | null) => {
    setEditingId(row?.id ?? null);
    setDraft(
      row === null
        ? EMPTY_DRAFT
        : {
            key: row.key,
            name: row.name,
            provider: row.provider,
            contextWindow: row.contextWindow === null ? '' : String(row.contextWindow),
            inputPricePerMillion:
              row.inputPricePerMillion === null ? '' : String(row.inputPricePerMillion),
            outputPricePerMillion:
              row.outputPricePerMillion === null ? '' : String(row.outputPricePerMillion),
            isDefault: row.isDefault,
            isEnabled: row.isEnabled,
          },
    );
    setError(undefined);
    setDialogOpen(true);
  };

  const save = useCallback(async () => {
    const input = toInput(draft);
    if ('error' in input) {
      setError(input.error);
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      if (editingId === null) {
        await aiApi.createModel(input);
        setNotice(`Model "${input.key}" added.`);
      } else {
        const { key: _key, ...update } = input;
        await aiApi.updateModel(editingId, update);
        setNotice(`Model "${input.key}" updated.`);
      }
      setDialogOpen(false);
      models.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }, [draft, editingId, models]);

  const requestDelete = (row: AiModelSummary) => {
    setDeleteError(undefined);
    setDeleting(row);
  };

  const confirmDelete = async () => {
    if (deleting === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await aiApi.removeModel(deleting.id);
      toast({
        title: 'Model deleted',
        description: `Model "${deleting.key}" was deleted.`,
        variant: 'success',
      });
      setDeleting(null);
      models.reload();
    } catch (cause) {
      // Surfaced inside the dialog so the reader can retry or back out.
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  };

  const toggle = async (
    row: AiModelSummary,
    patch: { isDefault?: boolean; isEnabled?: boolean },
  ) => {
    try {
      await aiApi.updateModel(row.id, patch);
      models.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Models"
        description="Available models, their pricing and the tenant default."
        actions={
          canManage && (
            <Button size="sm" onClick={() => open(null)}>
              <Plus className="mr-1 size-4" aria-hidden />
              Add model
            </Button>
          )
        }
      />

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <ErrorPanel error={models.error} onRetry={() => models.reload()} />

      <HrisDataTable
        rows={rows}
        columns={buildModelColumns({
          canUpdate,
          canDelete,
          onToggle: toggle,
          onEdit: open,
          onDelete: requestDelete,
        })}
        filters={buildModelFilters(rows)}
        searchable
        searchText={MODEL_SEARCH_TEXT}
        searchPlaceholder="Search by model key, name or provider…"
        selectable={false}
        views={{ builtIn: MODEL_BUILT_IN_VIEWS, storageKey: MODEL_VIEWS_STORAGE_KEY }}
        status={models.loading ? 'loading' : models.error !== undefined ? 'error' : 'ready'}
        errorCopy={models.error}
        onRetry={() => models.reload()}
        emptyTitle="No models catalogued"
        emptyDescription="The gateway falls back to its environment model."
        noResultsTitle="No models match this filter"
        noResultsDescription="Try a different search or clear the filters to see every model."
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) setDialogOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId === null ? 'Add model' : 'Edit model'}</DialogTitle>
            <DialogDescription>
              Pricing is USD per million tokens and feeds Usage &amp; Cost estimates.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormField label="Model key" htmlFor="model-key" required errorId="model-key-error">
              <Input
                id="model-key"
                value={draft.key}
                disabled={editingId !== null}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, key: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField
              label="Display name"
              htmlFor="model-name"
              required
              errorId="model-name-error"
            >
              <Input
                id="model-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField
              label="Context window (tokens)"
              htmlFor="model-window"
              errorId="model-window-error"
            >
              <Input
                id="model-window"
                inputMode="numeric"
                value={draft.contextWindow}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, contextWindow: event.currentTarget.value }))
                }
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Input $ / 1M"
                htmlFor="model-price-in"
                errorId="model-price-in-error"
              >
                <Input
                  id="model-price-in"
                  inputMode="decimal"
                  value={draft.inputPricePerMillion}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      inputPricePerMillion: event.currentTarget.value,
                    }))
                  }
                />
              </FormField>
              <FormField
                label="Output $ / 1M"
                htmlFor="model-price-out"
                errorId="model-price-out-error"
              >
                <Input
                  id="model-price-out"
                  inputMode="decimal"
                  value={draft.outputPricePerMillion}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      outputPricePerMillion: event.currentTarget.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Default model</span>
              <Switch
                checked={draft.isDefault}
                onCheckedChange={(next) => setDraft((current) => ({ ...current, isDefault: next }))}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Enabled</span>
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
                {editingId === null ? 'Add model' : 'Save changes'}
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete model "${deleting?.key ?? ''}"?`}
        description={
          <>
            The model's pricing is removed with it. Agents and calls that name{' '}
            <code className="font-mono">{deleting?.key ?? ''}</code> fall back to the tenant
            default, or to the gateway's environment model when none is set.
          </>
        }
        confirmLabel="Delete"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
