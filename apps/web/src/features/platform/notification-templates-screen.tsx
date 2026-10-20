'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HrisDataTable,
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
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
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { NotificationTemplateReadModel } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

interface Draft {
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
  readonly enabled: boolean;
}

const TEMPLATE_VIEWS_STORAGE_KEY = 'hris:notification-templates:views';

const CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: 'In-app' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PUSH', label: 'Push' },
];

const STATE_OPTIONS = [
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
];

function buildTemplateFilters(): readonly DataTableFilter<NotificationTemplateReadModel>[] {
  return [
    {
      kind: 'select',
      id: 'channel',
      label: 'Channel',
      placeholder: 'All channels',
      getValue: (row) => row.channel,
      options: CHANNEL_OPTIONS,
    },
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (row) => (row.enabled ? 'ENABLED' : 'DISABLED'),
      options: STATE_OPTIONS,
    },
  ];
}

const withTemplateState = (state: 'ENABLED' | 'DISABLED') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const TEMPLATE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All templates',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'enabled', name: 'Enabled', builtIn: true, state: withTemplateState('ENABLED') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withTemplateState('DISABLED') },
];

function buildTemplateColumns({
  onEdit,
}: {
  readonly onEdit?: (template: NotificationTemplateReadModel) => void;
}): readonly DataTableColumn<NotificationTemplateReadModel>[] {
  const columns: DataTableColumn<NotificationTemplateReadModel>[] = [
    {
      id: 'event',
      header: 'Event',
      sortValue: (row) => row.eventKey,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.eventKey,
    },
    {
      id: 'channel',
      header: 'Channel',
      sortValue: (row) => row.channel,
      cell: (row) => <Badge variant="outline">{row.channel}</Badge>,
    },
    {
      id: 'subject',
      header: 'Subject',
      sortValue: (row) => row.subjectTemplate,
      cellClassName: 'max-w-72 truncate text-sm',
      cell: (row) => (
        <span className="block truncate" title={row.subjectTemplate}>
          {row.subjectTemplate}
        </span>
      ),
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (row) => (row.enabled ? 'ENABLED' : 'DISABLED'),
      cell: (row) => (
        <Badge variant={row.enabled ? 'success' : 'secondary'}>
          {row.enabled ? 'ENABLED' : 'DISABLED'}
        </Badge>
      ),
    },
  ];

  if (onEdit !== undefined) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
            Edit
          </Button>
        </div>
      ),
    });
  }

  return columns;
}

/**
 * Per-event, per-channel message templates. Rendering is server-side (`{{key}}`
 * placeholders); this screen maintains the stored subject/body text.
 */
export function NotificationTemplatesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const templates = useIamLoad(() => platformApi.listNotificationTemplates(), []);
  const canManage = useCan('notification.update');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [editing, setEditing] = useState<NotificationTemplateReadModel | null>(null);
  const [draft, setDraft] = useState<Draft>({
    subjectTemplate: '',
    bodyTemplate: '',
    enabled: true,
  });
  const [pending, setPending] = useState(false);

  const rows = (templates.data ?? []) as NotificationTemplateReadModel[];

  const open = (template: NotificationTemplateReadModel) => {
    setEditing(template);
    setDraft({
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      enabled: template.enabled,
    });
  };

  const save = useCallback(async () => {
    if (editing === null) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await platformApi.updateNotificationTemplate(editing.eventKey, editing.channel, draft);
      setNotice(`Saved ${editing.eventKey} (${editing.channel}).`);
      setEditing(null);
      templates.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }, [editing, draft, templates]);

  return (
    <PageBody>
      <PageHeader
        title="Notification Templates"
        description="Email and in-app message templates rendered when an event fires."
      />

      {notice !== undefined && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildTemplateColumns({
          onEdit: canManage ? open : undefined,
        })}
        filters={buildTemplateFilters()}
        searchable
        searchText={(row) => `${row.eventKey} ${row.channel} ${row.subjectTemplate}`}
        searchPlaceholder="Search by event, channel or subject…"
        selectable={false}
        views={{ builtIn: TEMPLATE_BUILT_IN_VIEWS, storageKey: TEMPLATE_VIEWS_STORAGE_KEY }}
        status={
          templates.loading && rows.length === 0
            ? 'loading'
            : templates.error !== undefined
              ? 'error'
              : 'ready'
        }
        errorCopy={templates.error}
        onRetry={() => templates.reload()}
        emptyTitle="No templates defined"
        emptyDescription="Templates appear here once the platform seeds them."
        noResultsTitle="No templates match this filter"
        noResultsDescription="Try a different search or clear the filters to see every template."
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(openNext) => {
          if (!openNext) {
            setEditing(null);
            setError(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing !== null ? `${editing.eventKey} · ${editing.channel}` : 'Template'}
            </DialogTitle>
            <DialogDescription>
              Placeholders such as {'{{user.name}}'} are substituted server-side when the message is
              rendered.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormField
              label="Subject"
              htmlFor="template-subject"
              required
              errorId="template-subject-error"
            >
              <Input
                id="template-subject"
                value={draft.subjectTemplate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    subjectTemplate: event.currentTarget.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Body" htmlFor="template-body" required errorId="template-body-error">
              <Textarea
                id="template-body"
                rows={6}
                value={draft.bodyTemplate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bodyTemplate: event.currentTarget.value }))
                }
              />
            </FormField>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Enabled</span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(next) => setDraft((current) => ({ ...current, enabled: next }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <FormSubmitButton pending={pending}>Save template</FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
