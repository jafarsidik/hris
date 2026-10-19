'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import type { AiModelSummary, CreateAiModelInput } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  const remove = async (row: AiModelSummary) => {
    if (!window.confirm(`Delete model "${row.key}"?`)) return;
    try {
      await aiApi.removeModel(row.id);
      setNotice(`Model "${row.key}" deleted.`);
      models.reload();
    } catch (cause) {
      setError(messageOf(cause));
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

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {models.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{models.error}</AlertDescription>
        </Alert>
      )}

      {models.loading && rows.length === 0 ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No models catalogued. The gateway falls back to its environment model.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
            <CardDescription>
              {rows.length} model{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Context</TableHead>
                  <TableHead className="text-right">Price in / out (per 1M)</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{row.key}</div>
                      <div className="text-xs text-muted-foreground">{row.name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.provider}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.contextWindow ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.inputPricePerMillion === null ? '—' : `$${row.inputPricePerMillion}`} /{' '}
                      {row.outputPricePerMillion === null ? '—' : `$${row.outputPricePerMillion}`}
                    </TableCell>
                    <TableCell>
                      {row.isDefault ? (
                        <Badge variant="success">DEFAULT</Badge>
                      ) : (
                        canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void toggle(row, { isDefault: true })}
                          >
                            Make default
                          </Button>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isEnabled}
                        disabled={!canUpdate}
                        onCheckedChange={(next) => void toggle(row, { isEnabled: next })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate && (
                          <Button variant="outline" size="sm" onClick={() => open(row)}>
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void remove(row)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
    </PageBody>
  );
}
