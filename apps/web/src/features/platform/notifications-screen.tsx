'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { NotificationKind, NotificationReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

const KIND_VARIANT: Readonly<
  Record<NotificationKind, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'>
> = {
  info: 'secondary',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * Notification feed (System -> Communication).
 *
 * These endpoints are scoped to the signed-in recipient, so there is no resource
 * grant to check here; the API still rejects an unauthenticated caller.
 */
export function NotificationsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const notifications = useIamLoad(() => platformApi.listNotifications(), []);
  const unread = useIamLoad(() => platformApi.unreadNotificationCount(), []);

  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const markRead = useCallback(
    async (id: string) => {
      setError(undefined);
      try {
        await platformApi.markNotificationRead(id);
        notifications.reload();
        unread.reload();
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : 'The notification could not be read.',
        );
      }
    },
    [notifications, unread],
  );

  const markAllRead = useCallback(async () => {
    setError(undefined);
    try {
      await platformApi.markAllNotificationsRead();
      notifications.reload();
      unread.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'Notifications could not be updated.',
      );
    }
  }, [notifications, unread]);

  const rows: readonly NotificationReadModel[] = notifications.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description="In-app notifications and delivery status."
        actions={
          <Button
            variant="outline"
            disabled={(unread.data?.count ?? 0) === 0}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        }
      />

      {error !== undefined && <ErrorPanel error={error} />}

      <ErrorPanel error={notifications.error} onRetry={() => notifications.reload()} />

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {unread.loading
              ? 'Loading…'
              : `${unread.data?.count ?? 0} unread notification${
                  (unread.data?.count ?? 0) === 1 ? '' : 's'
                }.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no notifications.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((notification) => (
                <li
                  key={notification.id}
                  className="flex items-start justify-between gap-3 py-3"
                  data-unread={notification.readAt === null}
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={KIND_VARIANT[notification.kind]}>{notification.kind}</Badge>
                      <span className="truncate text-sm font-medium">{notification.title}</span>
                      {notification.readAt === null && <Badge variant="outline">Unread</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatTimestamp(notification.createdAt)}</span>
                      <span>{notification.channel}</span>
                      <span>{notification.deliveryStatus}</span>
                      {notification.href !== null && (
                        <a className="text-primary hover:underline" href={notification.href}>
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                  {notification.readAt === null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void markRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
