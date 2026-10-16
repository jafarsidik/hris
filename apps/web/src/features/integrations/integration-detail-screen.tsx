'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
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
import { FormErrorSummary, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import type {
  IntegrationDeliverySummary,
  IntegrationSummary,
  WebhookSubscriptionSummary,
} from '@hris/shared-types';
import { Check, Copy } from 'lucide-react';

import { getIntegrations } from './index';
import { KIND_LABELS, deliveryBadgeVariant, statusBadgeVariant } from './integration-presentation';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

function formatTimestamp(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/** Reveals a freshly issued webhook secret once, because the API never returns it again. */
function SecretDialog({
  secret,
  onOpenChange,
}: {
  readonly secret: string | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (secret !== null) {
      setCopied(false);
    }
  }, [secret]);

  async function copy() {
    if (secret === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={secret !== null} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Webhook signing secret</DialogTitle>
          <DialogDescription>
            Copy this secret now. It is shown once and cannot be retrieved again — rotate it to
            issue a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={secret ?? ''} className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One integration: its health and non-secret configuration, its delivery log, and — for a
 * webhook — its event subscriptions and signing secret.
 */
export function IntegrationDetailScreen({ id }: { readonly id: string }) {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIntegrations();
  const canManage = useCan('integration.manage');
  const canUpdate = useCan('integration.update');

  const [integration, setIntegration] = useState<IntegrationSummary | null>(null);
  const [deliveries, setDeliveries] = useState<readonly IntegrationDeliverySummary[]>([]);
  const [subscriptions, setSubscriptions] = useState<readonly WebhookSubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [testing, setTesting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [eventsText, setEventsText] = useState('');
  const [savingEvents, setSavingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await repository.getIntegration(id);
      const [logs, subs] =
        loaded.kind === 'WEBHOOK'
          ? await Promise.all([repository.listDeliveries(id), repository.listSubscriptions(id)])
          : [await repository.listDeliveries(id), []];
      setIntegration(loaded);
      setDeliveries(logs);
      setSubscriptions(subs);
      setEventsText(subs.map((entry) => entry.eventType).join(', '));
      setError(undefined);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'The integration could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [repository, id]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTest() {
    setTesting(true);
    setNotice(undefined);
    try {
      const result = await repository.testIntegration(id);
      setNotice(`${result.ok ? 'Connected' : 'Failed'}: ${result.message}`);
      await load();
    } catch (err) {
      setNotice(messageOf(err));
    } finally {
      setTesting(false);
    }
  }

  async function rotate() {
    setNotice(undefined);
    try {
      const rotated = await repository.rotateSecret(id);
      setSecret(rotated.secret);
      await load();
    } catch (err) {
      setNotice(messageOf(err));
    }
  }

  async function saveEvents() {
    setSavingEvents(true);
    setEventsError(undefined);
    try {
      const events = eventsText
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const updated = await repository.setSubscriptions(id, events);
      setSubscriptions(updated);
      setEventsText(updated.map((entry) => entry.eventType).join(', '));
    } catch (err) {
      setEventsError(messageOf(err));
    } finally {
      setSavingEvents(false);
    }
  }

  return (
    <PageBody>
      <PageHeader
        title={integration?.name ?? 'Integration'}
        description="Health, configuration, delivery log and webhook settings."
      />

      <div>
        <Button variant="outline" size="sm" render={<Link href="/setup/integrations" />}>
          Back to integrations
        </Button>
      </div>

      {notice !== undefined && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : integration === null ? null : (
        <>
          <Section bodyClassName="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(integration.status)}>{integration.status}</Badge>
              <Badge variant="secondary">{KIND_LABELS[integration.kind]}</Badge>
              <Badge variant={integration.isEnabled ? 'success' : 'outline'}>
                {integration.isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {integration.kind === 'WEBHOOK' && (
                <Badge variant={integration.secretConfigured ? 'success' : 'warning'}>
                  {integration.secretConfigured ? 'Secret set' : 'No secret'}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => void runTest()}
                  >
                    {testing ? 'Testing…' : 'Test connection'}
                  </Button>
                )}
                {integration.kind === 'WEBHOOK' && canManage && (
                  <Button variant="outline" size="sm" onClick={() => void rotate()}>
                    Rotate secret
                  </Button>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Key</dt>
                <dd className="font-mono text-xs">{integration.key}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd>{integration.provider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last checked</dt>
                <dd>{formatTimestamp(integration.lastCheckedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last message</dt>
                <dd>{integration.lastMessage ?? '—'}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Configuration</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {JSON.stringify(integration.config, null, 2)}
              </pre>
            </div>
          </Section>

          {integration.kind === 'WEBHOOK' && (
            <Section
              title="Event subscriptions"
              description={
                subscriptions.length === 0
                  ? 'No events subscribed.'
                  : `${subscriptions.length} subscribed event${subscriptions.length === 1 ? '' : 's'}.`
              }
              bodyClassName="flex flex-col gap-3"
            >
              {canUpdate ? (
                <div className="flex flex-col gap-2">
                  {eventsError !== undefined && <FormErrorSummary>{eventsError}</FormErrorSummary>}
                  <FormField
                    label="Event types"
                    htmlFor="subscription-events"
                    error={undefined}
                    errorId="subscription-events-error"
                    hint="Comma-separated. Use * to subscribe to every event. Saving replaces the whole set."
                  >
                    <Textarea
                      id="subscription-events"
                      className="font-mono text-xs"
                      value={eventsText}
                      onChange={(event) => setEventsText(event.currentTarget.value)}
                    />
                  </FormField>
                  <div>
                    <Button disabled={savingEvents} onClick={() => void saveEvents()}>
                      {savingEvents ? 'Saving…' : 'Save subscriptions'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subscriptions.map((entry) => (
                    <Badge key={entry.id} variant="secondary">
                      {entry.eventType}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Delivery log" bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempt</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(entry.createdAt)}
                    </TableCell>
                    <TableCell>{entry.direction}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.operation}</TableCell>
                    <TableCell>
                      <Badge variant={deliveryBadgeVariant(entry.status)}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{entry.attempt}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.durationMs === null ? '—' : `${entry.durationMs} ms`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.error ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {deliveries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No deliveries recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Section>
        </>
      )}

      <SecretDialog secret={secret} onOpenChange={(open) => !open && setSecret(null)} />
    </PageBody>
  );
}
