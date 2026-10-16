'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SessionInfo } from '@hris/shared-types';

import { listSessions, revokeSession } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { Monitor, Smartphone, Laptop } from 'lucide-react';

function deviceIcon(userAgent: string | null) {
  const value = (userAgent ?? '').toLowerCase();
  if (value.includes('mobile') || value.includes('android') || value.includes('iphone')) {
    return <Smartphone aria-hidden="true" className="size-4" />;
  }
  if (value.includes('tablet') || value.includes('ipad')) {
    return <Monitor aria-hidden="true" className="size-4" />;
  }
  return <Laptop aria-hidden="true" className="size-4" />;
}

export function AccountSessionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const sessions = useIamLoad(() => listSessions(), []);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await revokeSession(id);
      sessions.reload();
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Active Sessions"
        description="Devices currently signed into your account."
        actions={
          <Button variant="outline" onClick={() => router.push('/setup/account')}>
            Back to account
          </Button>
        }
      />
      {sessions.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sessions.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {sessions.error}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Signed in</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.data?.map((session: SessionInfo) => (
              <TableRow key={session.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    {deviceIcon(session.userAgent)}
                    <span className="max-w-48 truncate">
                      {session.userAgent ?? 'Unknown device'}
                    </span>
                    {session.isCurrent && <Badge>Current</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(session.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(session.lastSeenAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {session.isCurrent ? (
                    <span className="text-xs text-muted-foreground">This session</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revokingId === session.id}
                      onClick={() => void revoke(session.id)}
                    >
                      Sign out
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(sessions.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No active sessions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <p className="text-sm text-muted-foreground">
        <Link href="/setup/account" className="hover:underline">
          Return to My Account
        </Link>
      </p>
    </PageBody>
  );
}
