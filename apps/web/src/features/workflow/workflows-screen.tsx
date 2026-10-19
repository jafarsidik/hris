'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { EffectivePermission } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { workflowApi, type WorkflowVersionBody } from '@/features/workflow/workflow-api';
import { ApiRequestError } from '@/lib/api/http-client';

type Tone = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

const VERSION_TONE: Readonly<Record<'DRAFT' | 'ACTIVE' | 'ARCHIVED', Tone>> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'secondary',
};

const EMPTY_FORM = { key: '', name: '', description: '' };

/** Whether a fully-qualified `resource.action` is held. Presentation only. */
function holds(permissions: readonly EffectivePermission[], key: string): boolean {
  const separator = key.lastIndexOf('.');
  const resource = key.slice(0, separator);
  const action = key.slice(separator + 1);
  return permissions.some(
    (permission) => permission.resource === resource && permission.action === action,
  );
}

/** The body of one version, validated before it is sent. */
function isVersionBody(value: unknown): value is WorkflowVersionBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record['states']) || !Array.isArray(record['transitions'])) {
    return false;
  }
  return record['steps'] === undefined || Array.isArray(record['steps']);
}

/**
 * Workflow definition authoring (System -> Workflow & Automation).
 *
 * Publishing is the point of no return: a published version is immutable and is what new
 * instances pin, so the draft is where every edit happens. The draft body is edited as
 * JSON because the engine's shape is two (optionally three) arrays and a form that hid
 * them would make a mis-typed key harder to find, not easier.
 */
export function WorkflowsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const definitions = useIamLoad(() => workflowApi.listDefinitions(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [draftText, setDraftText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const permissions = state.status === 'authenticated' ? state.session.permissions : [];
  const canCreate = holds(permissions, 'workflow.create');
  const canUpdate = holds(permissions, 'workflow.update');

  const detail = useIamLoad(
    () => (selectedId === null ? Promise.resolve(null) : workflowApi.getDefinition(selectedId)),
    [selectedId],
  );

  const draft = detail.data?.versions.find((version) => version.status === 'DRAFT') ?? null;

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    setDraftText(
      draft === null
        ? ''
        : JSON.stringify(
            { states: draft.states, transitions: draft.transitions, steps: draft.steps ?? [] },
            null,
            2,
          ),
    );
  }, [draft]);

  const message = (cause: unknown, fallback: string): string =>
    cause instanceof ApiRequestError ? cause.message : fallback;

  const createDefinition = useCallback(async () => {
    setError(undefined);
    setBusy('create');
    try {
      const created = await workflowApi.createDefinition({
        key: form.key.trim(),
        name: form.name.trim(),
        ...(form.description.trim().length === 0 ? {} : { description: form.description.trim() }),
      });
      setForm(EMPTY_FORM);
      definitions.reload();
      setSelectedId(created.id);
    } catch (cause) {
      setError(message(cause, 'The workflow could not be created.'));
    } finally {
      setBusy(null);
    }
  }, [definitions, form]);

  const createVersion = useCallback(async () => {
    if (selectedId === null) {
      return;
    }
    setError(undefined);
    setBusy('version');
    try {
      await workflowApi.createVersion(selectedId);
      detail.reload();
    } catch (cause) {
      setError(message(cause, 'A new draft could not be created.'));
    } finally {
      setBusy(null);
    }
  }, [detail, selectedId]);

  const publishVersion = useCallback(
    async (version: number) => {
      if (selectedId === null) {
        return;
      }
      setError(undefined);
      setBusy('publish');
      try {
        await workflowApi.publishVersion(selectedId, version);
        detail.reload();
        definitions.reload();
      } catch (cause) {
        setError(message(cause, 'The version could not be published.'));
      } finally {
        setBusy(null);
      }
    },
    [definitions, detail, selectedId],
  );

  const saveDraft = useCallback(async () => {
    if (selectedId === null || draft === null) {
      return;
    }
    const parsed: unknown = (() => {
      try {
        return JSON.parse(draftText) as unknown;
      } catch {
        return undefined;
      }
    })();
    if (!isVersionBody(parsed)) {
      setError('The draft must be JSON with `states` and `transitions` arrays.');
      return;
    }
    setError(undefined);
    setBusy('save');
    try {
      await workflowApi.updateVersion(selectedId, draft.version, parsed);
      detail.reload();
    } catch (cause) {
      setError(message(cause, 'The draft could not be saved.'));
    } finally {
      setBusy(null);
    }
  }, [detail, draft, draftText, selectedId]);

  const rows = definitions.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Workflows"
        description="Versioned approval and routing definitions. Only a published version runs."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {definitions.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{definitions.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
          <CardDescription>
            Select a definition to inspect and publish its versions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {definitions.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No workflows are defined yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((definition) => (
                <li key={definition.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{definition.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <code>{definition.key}</code>
                      {definition.description === null ? '' : ` · ${definition.description}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {definition.activeVersion !== null && (
                      <Badge variant="success">v{definition.activeVersion} active</Badge>
                    )}
                    {definition.draftVersion !== null && (
                      <Badge variant="warning">v{definition.draftVersion} draft</Badge>
                    )}
                    <Button
                      variant={selectedId === definition.id ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedId(definition.id)}
                    >
                      {selectedId === definition.id ? 'Selected' : 'Open'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New definition</CardTitle>
            <CardDescription>
              A key is stable and lower-case (letters, digits, underscores); first create the
              definition, then add a version.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workflow-key">Key</Label>
                <Input
                  id="workflow-key"
                  value={form.key}
                  placeholder="leave_request"
                  onChange={(event) => setForm((f) => ({ ...f, key: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workflow-name">Name</Label>
                <Input
                  id="workflow-name"
                  value={form.name}
                  placeholder="Leave request approval"
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workflow-description">Description</Label>
              <Input
                id="workflow-description"
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              />
            </div>
            <div>
              <Button
                disabled={
                  busy !== null || form.key.trim().length === 0 || form.name.trim().length === 0
                }
                onClick={() => void createDefinition()}
              >
                Create workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{detail.data?.definition.name ?? 'Loading…'}</CardTitle>
            <CardDescription>
              {detail.data === null
                ? 'The definition is being loaded.'
                : `key: ${detail.data.definition.key}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {detail.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : detail.data === null ? (
              <p className="text-sm text-muted-foreground">The definition could not be loaded.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {detail.data.versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <Badge variant={VERSION_TONE[version.status]}>{version.status}</Badge>
                      <span className="text-sm font-medium">Version {version.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {version.states.length} states · {version.transitions.length} transitions ·{' '}
                        {(version.steps ?? []).length} steps
                      </span>
                      {version.status === 'DRAFT' && canUpdate && (
                        <Button
                          className="ml-auto"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void publishVersion(version.version)}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {canUpdate && (
                  <div className="flex flex-col gap-2">
                    {draft === null ? (
                      <div>
                        <Button
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => void createVersion()}
                        >
                          Create draft version
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Label htmlFor="workflow-draft">
                          Draft v{draft.version} — states, transitions and steps
                        </Label>
                        <Textarea
                          id="workflow-draft"
                          className="min-h-64 font-mono text-xs"
                          value={draftText}
                          onChange={(event) => setDraftText(event.target.value)}
                        />
                        <div>
                          <Button disabled={busy !== null} onClick={() => void saveDraft()}>
                            Save draft
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
