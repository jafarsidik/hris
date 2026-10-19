'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { NotificationChannel, SystemSettingReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useCan, useSession } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
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

interface ChannelFacts {
  readonly channel: NotificationChannel;
  readonly title: string;
  readonly summary: string;
  readonly enabledKey: string;
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly detail: string;
  readonly configureHref: string | null;
}

function readBool(
  settings: ReadonlyMap<string, SystemSettingReadModel>,
  key: string,
  fallback: boolean,
): boolean {
  const value = settings.get(key)?.value;
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Messaging channels: which delivery channels exist, whether each is enabled for this
 * tenant, and whether its transport is actually in place. Enabled/disabled writes the
 * `notification.*.enabled` setting; transport setup lives on the Email page.
 */
export function MessagingChannelsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const notification = useIamLoad(() => repository.listSettings('notification'), []);
  const email = useIamLoad(() => repository.listSettings('email'), []);
  const canManage = useCan('setting.update');

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [pendingChannel, setPendingChannel] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const settings = useMemo(() => {
    const map = new Map<string, SystemSettingReadModel>();
    for (const row of [...(notification.data ?? []), ...(email.data ?? [])]) {
      map.set(row.key, row);
    }
    return map;
  }, [notification.data, email.data]);

  const channels: readonly ChannelFacts[] = useMemo(() => {
    const smtpHostValue = settings.get('email.smtpHost')?.value;
    const smtpHost = typeof smtpHostValue === 'string' ? smtpHostValue.trim() : '';
    const smtpPortValue = settings.get('email.smtpPort')?.value;
    const smtpPort = typeof smtpPortValue === 'number' ? smtpPortValue : 587;
    const emailReady = smtpHost !== '';
    return [
      {
        channel: 'IN_APP',
        title: 'In-app',
        summary: 'Notification bell inside the product',
        enabledKey: 'notification.inApp.enabled',
        enabled: readBool(settings, 'notification.inApp.enabled', true),
        configured: true,
        detail: 'Built-in notification feed',
        configureHref: null,
      },
      {
        channel: 'EMAIL',
        title: 'Email',
        summary: 'SMTP delivery to user mailboxes',
        enabledKey: 'notification.email.enabled',
        enabled: readBool(settings, 'notification.email.enabled', true),
        configured: emailReady,
        detail: emailReady
          ? `SMTP relay ${smtpHost}:${smtpPort}`
          : 'No SMTP relay configured — outbound email is paused',
        configureHref: '/setup/email',
      },
      {
        channel: 'PUSH',
        title: 'Push',
        summary: 'Mobile and web push notifications',
        enabledKey: 'notification.push.enabled',
        enabled: readBool(settings, 'notification.push.enabled', false),
        configured: false,
        detail: 'Push transport not yet connected',
        configureHref: null,
      },
    ] as const;
  }, [settings]);

  const setEnabled = useCallback(
    async (channel: ChannelFacts, enabled: boolean) => {
      setError(undefined);
      setNotice(undefined);
      setPendingChannel(channel.channel);
      try {
        await repository.updateSettings([{ key: channel.enabledKey, value: enabled }]);
        setNotice(`${channel.title} notifications ${enabled ? 'enabled' : 'disabled'}.`);
        notification.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setPendingChannel(null);
      }
    },
    [repository, notification],
  );

  const loading = notification.loading || email.loading;
  const loadError = notification.error ?? email.error;

  return (
    <PageBody>
      <PageHeader
        title="Messaging Channels"
        description="Delivery channels for notifications and their transport readiness."
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
      {loadError !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {channels.map((channel) => {
            const blocked = channel.enabled && !channel.configured;
            return (
              <Card key={channel.channel}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{channel.title}</CardTitle>
                    <Badge variant={channel.configured ? 'success' : 'secondary'}>
                      {channel.configured ? 'READY' : 'NOT READY'}
                    </Badge>
                  </div>
                  <CardDescription>{channel.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{channel.detail}</p>
                  {blocked && (
                    <p className="text-destructive text-sm">
                      Enabled but not transport-ready — deliveries will fail.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{channel.enabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch
                      checked={channel.enabled}
                      disabled={!canManage || pendingChannel === channel.channel}
                      onCheckedChange={(next) => void setEnabled(channel, next)}
                    />
                  </div>
                  {channel.configureHref !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={channel.configureHref} />}
                    >
                      Configure transport
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}
