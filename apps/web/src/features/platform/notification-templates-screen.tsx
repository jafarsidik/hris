'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { NotificationTemplateReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
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
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
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

interface Draft {
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
  readonly enabled: boolean;
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
      {templates.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{templates.error}</AlertDescription>
        </Alert>
      )}

      {templates.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No templates defined" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              {rows.length} template{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((template) => (
                  <TableRow key={`${template.eventKey}:${template.channel}`}>
                    <TableCell className="font-mono text-sm">{template.eventKey}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.channel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-sm">
                      {template.subjectTemplate}
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.enabled ? 'success' : 'secondary'}>
                        {template.enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => open(template)}>
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
