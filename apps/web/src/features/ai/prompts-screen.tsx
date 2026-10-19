'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import type { AiPromptSummary } from '@hris/shared-types';

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
import { Textarea } from '@/components/ui/textarea';
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

interface PromptDraft {
  key: string;
  name: string;
  content: string;
  isEnabled: boolean;
}

/**
 * Prompts: versioned system-prompt templates. Enabling a version retires its siblings,
 * and the gateway picks up the enabled version for its key on the next ask — the
 * built-in prompt stays in effect until a key has an enabled version.
 */
export function PromptsScreen() {
  const router = useRouter();
  const { state } = useSession();
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

  const rows = (prompts.data ?? []) as readonly AiPromptSummary[];

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

  const remove = async (row: AiPromptSummary) => {
    if (!window.confirm(`Delete ${row.key} v${row.version}?`)) return;
    try {
      await aiApi.removePrompt(row.id);
      setNotice(`Deleted ${row.key} v${row.version}.`);
      prompts.reload();
    } catch (cause) {
      setError(messageOf(cause));
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

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {prompts.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{prompts.error}</AlertDescription>
        </Alert>
      )}

      {prompts.loading && rows.length === 0 ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No prompt versions yet — the gateway uses its built-in prompt.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>
              {rows.length} version{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.key}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.version}</TableCell>
                    <TableCell className="text-sm">{row.name ?? '—'}</TableCell>
                    <TableCell className="max-w-72 truncate text-muted-foreground text-sm">
                      {row.content}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.isEnabled}
                          disabled={!canUpdate}
                          onCheckedChange={(next) => void setEnabled(row, next)}
                        />
                        {row.isEnabled && <Badge variant="success">LIVE</Badge>}
                      </div>
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
