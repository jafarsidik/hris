'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import type { SessionInfo } from '@hris/shared-types';

import { listSessions, revokeSession } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { Laptop, LogOutIcon, Monitor, MoreHorizontalIcon, Smartphone } from 'lucide-react';

/**
 * The signed-in devices of the account viewing this page.
 *
 * "Sign out" used to be a bare button in the last column that revoked the session the moment
 * it was clicked. It now goes through the screen's `ConfirmDialog`: signing a device out is
 * not reversible from here — the reader has to sign in again on that device — and the button
 * sat one pixel away from a row of others with nothing naming the device it belonged to.
 *
 * The columns are declared here rather than in a `*-table-config.tsx` module: this table has
 * one consumer, no filters and no saved views, so a second file would only add a hop.
 */

const signedInFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const lastActiveFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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

function SessionRowMenu({
  session,
  onSignOut,
}: {
  readonly session: SessionInfo;
  readonly onSignOut: (session: SessionInfo) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${session.userAgent ?? 'this device'}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem variant="destructive" onClick={() => onSignOut(session)}>
          <LogOutIcon aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountSessionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const sessions = useIamLoad(() => listSessions(), []);
  const [signingOut, setSigningOut] = useState<SessionInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  async function confirmSignOut(): Promise<void> {
    if (signingOut === null) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await revokeSession(signingOut.id);
      toast({
        title: 'Device signed out',
        description: `${signingOut.userAgent ?? 'That device'} has to sign in again.`,
        variant: 'success',
      });
      setSigningOut(null);
      sessions.reload();
    } catch {
      setError('That device could not be signed out. Try again.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<SessionInfo>[] = [
    {
      id: 'device',
      header: 'Device',
      sortValue: (session) => session.userAgent ?? '',
      cell: (session) => (
        <span className="inline-flex items-center gap-2">
          {deviceIcon(session.userAgent)}
          <span className="max-w-48 truncate" title={session.userAgent ?? undefined}>
            {session.userAgent ?? 'Unknown device'}
          </span>
          {session.isCurrent && <Badge>Current</Badge>}
        </span>
      ),
    },
    {
      id: 'signedIn',
      header: 'Signed in',
      sortValue: (session) => session.createdAt,
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-muted-foreground',
      cell: (session) => signedInFormat.format(new Date(session.createdAt)),
    },
    {
      id: 'lastActive',
      header: 'Last active',
      sortValue: (session) => session.lastSeenAt,
      cellClassName: 'whitespace-nowrap tabular-nums text-muted-foreground',
      cell: (session) => lastActiveFormat.format(new Date(session.lastSeenAt)),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (session) =>
        session.isCurrent ? (
          // The reader's own session is not something to offer a sign-out for from a row
          // menu; the account menu already has that, and it means "leave this page".
          <span className="text-xs text-muted-foreground">This session</span>
        ) : (
          <SessionRowMenu session={session} onSignOut={setSigningOut} />
        ),
    },
  ];

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

      <HrisDataTable
        rows={sessions.data ?? []}
        columns={columns}
        searchable
        searchText={(session) => `${session.userAgent ?? ''} ${session.isCurrent ? 'current' : ''}`}
        searchPlaceholder="Search by device…"
        /* No selection and no paging: an account has a handful of sessions, and a bulk
           "sign out everything" already exists as its own action in the API. */
        selectable={false}
        pagination={false}
        status={sessions.loading ? 'loading' : sessions.error !== undefined ? 'error' : 'ready'}
        errorCopy={sessions.error}
        onRetry={sessions.reload}
        emptyTitle="No active sessions"
        emptyDescription="Devices you sign in from appear here, with the option to sign them out."
        noResultsTitle="No session matches that search"
      />

      <ConfirmDialog
        open={signingOut !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSigningOut(null);
            setError(undefined);
          }
        }}
        title="Sign this device out?"
        description={
          <>
            {signingOut?.userAgent ?? 'That device'} is signed out immediately and has to sign in
            again. Work that was not saved on it is lost.
          </>
        }
        confirmLabel="Sign out"
        tone="destructive"
        pending={pending}
        error={error}
        onConfirm={() => void confirmSignOut()}
      />

      <p className="text-sm text-muted-foreground">
        <Link href="/setup/account" className="hover:underline">
          Return to My Account
        </Link>
      </p>
    </PageBody>
  );
}
