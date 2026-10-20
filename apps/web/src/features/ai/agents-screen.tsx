'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { AI_BUILTIN_TOOLS, type AiAgentSummary } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import {
  AGENT_BUILT_IN_VIEWS,
  AGENT_SEARCH_TEXT,
  AGENT_VIEWS_STORAGE_KEY,
  buildAgentColumns,
  buildAgentFilters,
} from '@/features/ai/agent-table-config';
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
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<AiAgentSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

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

  const requestDelete = (row: AiAgentSummary) => {
    setDeleteError(undefined);
    setDeleting(row);
  };

  const confirmDelete = async () => {
    if (deleting === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await aiApi.removeAgent(deleting.id);
      toast({
        title: 'Agent deleted',
        description: `Agent "${deleting.key}" was deleted.`,
        variant: 'success',
      });
      setDeleting(null);
      agents.reload();
    } catch (cause) {
      // Surfaced inside the dialog so the reader can retry or back out.
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
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

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <ErrorPanel error={agents.error} onRetry={() => agents.reload()} />

      <HrisDataTable
        rows={rows}
        columns={buildAgentColumns({
          canUpdate,
          canDelete,
          onToggleEnabled: toggleEnabled,
          onEdit: open,
          onDelete: requestDelete,
        })}
        filters={buildAgentFilters()}
        searchable
        searchText={AGENT_SEARCH_TEXT}
        searchPlaceholder="Search by agent name, key, prompt or model…"
        selectable={false}
        views={{ builtIn: AGENT_BUILT_IN_VIEWS, storageKey: AGENT_VIEWS_STORAGE_KEY }}
        status={agents.loading ? 'loading' : agents.error !== undefined ? 'error' : 'ready'}
        errorCopy={agents.error}
        onRetry={() => agents.reload()}
        emptyTitle="No agents yet"
        emptyDescription="`/ai/ask` runs with the built-in assistant until one exists."
        noResultsTitle="No agents match this filter"
        noResultsDescription="Try a different search or clear the filters to see every agent."
      />

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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete agent "${deleting?.key ?? ''}"?`}
        description={
          <>
            The agent's prompt, model and tool grants are removed with it. Calls to{' '}
            <code className="font-mono">/ai/ask</code> with{' '}
            <code className="font-mono">{deleting?.key ?? ''}</code> fall back to the built-in
            assistant.
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
