'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { NotificationChannel, NotificationPreferenceReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useSession } from '@/features/auth/session-context';
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

const CHANNEL_COPY: Readonly<Record<NotificationChannel, { title: string; summary: string }>> = {
  IN_APP: { title: 'In-app', summary: 'Notification bell inside the product' },
  EMAIL: { title: 'Email', summary: 'Delivery to your mailbox' },
  PUSH: { title: 'Push', summary: 'Mobile and web push, where enrolled' },
};

/**
 * The caller's own channel preferences (quiet toggles per channel). Self-scoped: the API
 * requires only authentication, so this screen carries no permission gate.
 */
export function NotificationPreferencesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const preferences = useIamLoad(() => platformApi.listNotificationPreferences(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [pendingChannel, setPendingChannel] = useState<string | null>(null);

  const rows = (preferences.data ?? []) as NotificationPreferenceReadModel[];

  const setEnabled = useCallback(
    async (channel: NotificationChannel, enabled: boolean) => {
      setError(undefined);
      setNotice(undefined);
      setPendingChannel(channel);
      try {
        await platformApi.saveNotificationPreferences([{ channel, enabled }]);
        setNotice(
          `${CHANNEL_COPY[channel].title} notifications ${enabled ? 'enabled' : 'disabled'}.`,
        );
        preferences.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setPendingChannel(null);
      }
    },
    [preferences],
  );

  return (
    <PageBody>
      <PageHeader
        title="Notification Preferences"
        description="Choose which channels deliver notifications to you."
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
      {preferences.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{preferences.error}</AlertDescription>
        </Alert>
      )}

      {preferences.loading && rows.length === 0 ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No channels available" />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Channels</CardTitle>
            <CardDescription>
              Applies to your account only. Company-wide delivery is configured under Messaging
              Channels.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {rows.map((row, index) => {
              const copy = CHANNEL_COPY[row.channel];
              return (
                <div
                  key={row.channel}
                  className={`flex items-center justify-between gap-4 py-3 ${
                    index > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{copy?.title ?? row.channel}</div>
                    <p className="text-muted-foreground text-sm">{copy?.summary ?? row.channel}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{row.enabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch
                      checked={row.enabled}
                      disabled={pendingChannel === row.channel}
                      onCheckedChange={(next) => void setEnabled(row.channel, next)}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
