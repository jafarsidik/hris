'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { AI_BUILTIN_TOOLS, type AiAgentSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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

interface AgentDraft {
  key: string;
  name: string;
  description: string;
  promptKey: string;
  modelKey: string;
  tools: readonly string[];
  isEnabled: boolean;
}

const EMPTY_DRAFT: AgentDraft = {
  key: '',
  name: '',
  description: '',
  promptKey: '',
  modelKey: '',
  tools: [],
  isEnabled: false,
};

/**
 * Agents: assistant definitions applied by `/ai/ask` when `agentKey` is supplied —
 * which prompt, which catalogued model and which built-in tools the agent may use.
 */
export function AgentsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const agents = useIamLoad(() => aiApi.listAgents(), []);
  const prompts = useIamLoad(() => aiApi.listPrompts(), []);
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
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);

  const rows = (agents.data ?? []) as readonly AiAgentSummary[];

  const promptKeys = [
    ...new Set(((prompts.data ?? []) as readonly { key: string }[]).map((row) => row.key)),
  ];
  const modelKeys = ((models.data ?? []) as readonly { key: string }[]).map((row) => row.key);

  const open = (row: AiAgentSummary | null) => {
    setEditingId(row?.id ?? null);
    setDraft(
      row === null
        ? EMPTY_DRAFT
        : {
            key: row.key,
            name: row.name,
            description: row.description ?? '',
            promptKey: row.promptKey ?? '',
            modelKey: row.modelKey ?? '',
            tools: row.tools,
            isEnabled: row.isEnabled,
          },
    );
    setError(undefined);
    setDialogOpen(true);
  };

  const save = useCallback(async () => {
    if (draft.name.trim() === '') {
      setError('Name is required.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const common = {
        name: draft.name.trim(),
        description: draft.description.trim() === '' ? null : draft.description.trim(),
        promptKey: draft.promptKey.trim() === '' ? null : draft.promptKey.trim(),
        modelKey: draft.modelKey.trim() === '' ? null : draft.modelKey.trim(),
        tools: draft.tools,
        isEnabled: draft.isEnabled,
      };
      if (editingId === null) {
        if (draft.key.trim() === '') {
          setError('Key is required.');
          setPending(false);
          return;
        }
        await aiApi.createAgent({ key: draft.key.trim(), ...common });
        setNotice(`Agent "${draft.key.trim()}" created.`);
      } else {
        await aiApi.updateAgent(editingId, common);
        setNotice(`Agent "${draft.key.trim()}" updated.`);
      }
      setDialogOpen(false);
      agents.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }, [draft, editingId, agents]);

  const remove = async (row: AiAgentSummary) => {
    if (!window.confirm(`Delete agent "${row.key}"?`)) return;
    try {
      await aiApi.removeAgent(row.id);
      setNotice(`Agent "${row.key}" deleted.`);
      agents.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const toggleEnabled = async (row: AiAgentSummary, enabled: boolean) => {
    try {
      await aiApi.updateAgent(row.id, { isEnabled: enabled });
      agents.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Agents"
        description="Assistants defined by a prompt, a model and the tools they may use."
        actions={
          canManage && (
            <Button size="sm" onClick={() => open(null)}>
              <Plus className="mr-1 size-4" aria-hidden />
              New agent
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
      {agents.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{agents.error}</AlertDescription>
        </Alert>
      )}

      {agents.loading && rows.length === 0 ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agents defined — `/ai/ask` runs with the built-in assistant until one exists.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Agents</CardTitle>
            <CardDescription>
              {rows.length} agent{rows.length === 1 ? '' : 's'} · pass{' '}
              <code className="font-mono">agentKey</code> to `/ai/ask` to use one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.promptKey ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{row.modelKey ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.tools.length === 0 ? (
                          <span className="text-muted-foreground text-sm">none</span>
                        ) : (
                          row.tools.map((tool) => (
                            <Badge key={tool} variant="outline">
                              {tool}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isEnabled}
                        disabled={!canUpdate}
                        onCheckedChange={(next) => void toggleEnabled(row, next)}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId === null ? 'New agent' : 'Edit agent'}</DialogTitle>
            <DialogDescription>
              An agent without a prompt or model falls back to the built-in prompt and the default
              model.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormField label="Key" htmlFor="agent-key" required errorId="agent-key-error">
              <Input
                id="agent-key"
                placeholder="policy-assistant"
                value={draft.key}
                disabled={editingId !== null}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, key: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField label="Name" htmlFor="agent-name" required errorId="agent-name-error">
              <Input
                id="agent-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="agent-description"
              errorId="agent-description-error"
            >
              <Textarea
                id="agent-description"
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.currentTarget.value }))
                }
              />
            </FormField>
            <FormField label="Prompt key" htmlFor="agent-prompt" errorId="agent-prompt-error">
              <Input
                id="agent-prompt"
                list="agent-prompt-keys"
                placeholder="policy-faq.system"
                value={draft.promptKey}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, promptKey: event.currentTarget.value }))
                }
              />
              <datalist id="agent-prompt-keys">
                {promptKeys.map((key) => (
                  <option key={key} value={key} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Model key" htmlFor="agent-model" errorId="agent-model-error">
              <Input
                id="agent-model"
                list="agent-model-keys"
                placeholder="defaults to the catalogue default"
                value={draft.modelKey}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, modelKey: event.currentTarget.value }))
                }
              />
              <datalist id="agent-model-keys">
                {modelKeys.map((key) => (
                  <option key={key} value={key} />
                ))}
              </datalist>
            </FormField>

            <div className="flex flex-col gap-2 py-2">
              <span className="font-medium text-sm">Tools</span>
              {AI_BUILTIN_TOOLS.map((tool) => (
                <label key={tool.key} className="flex items-start gap-2">
                  <Checkbox
                    aria-label={tool.name}
                    checked={draft.tools.includes(tool.key)}
                    onCheckedChange={(next) =>
                      setDraft((current) => ({
                        ...current,
                        tools:
                          next === true
                            ? [...current.tools, tool.key]
                            : current.tools.filter((key) => key !== tool.key),
                      }))
                    }
                  />
                  <span className="text-sm">{`${tool.name} — ${tool.description}`}</span>
                </label>
              ))}
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
                {editingId === null ? 'Create agent' : 'Save changes'}
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
