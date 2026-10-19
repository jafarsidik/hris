'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

/**
 * Approval authority (System -> Access Management).
 *
 * Configures who may approve what, up to a monetary limit, and temporary delegations.
 * Enforcing these rules when routing an approval is the M07 workflow engine's job.
 */
export function ApprovalAuthorityScreen() {
  const router = useRouter();
  const { state } = useSession();
  const authorities = useIamLoad(() => platformApi.listAuthorities(), []);
  const delegations = useIamLoad(() => platformApi.listDelegations(), []);

  const [error, setError] = useState<string | undefined>();
  const [rule, setRule] = useState({
    subjectId: '',
    subjectType: 'ROLE',
    maxAmount: '',
    currencyCode: 'IDR',
  });
  const [delegation, setDelegation] = useState({
    delegatorUserId: '',
    delegateeUserId: '',
    reason: '',
  });

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const submitRule = useCallback(async () => {
    setError(undefined);
    try {
      await platformApi.createAuthority({
        subjectType: rule.subjectType as 'ROLE' | 'USER',
        subjectId: rule.subjectId,
        ...(rule.maxAmount.length > 0
          ? { maxAmount: rule.maxAmount, currencyCode: rule.currencyCode }
          : {}),
      });
      setRule({ subjectId: '', subjectType: rule.subjectType, maxAmount: '', currencyCode: 'IDR' });
      authorities.reload();
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'The rule could not be saved.');
    }
  }, [rule, authorities]);

  const submitDelegation = useCallback(async () => {
    setError(undefined);
    try {
      await platformApi.createDelegation({
        delegatorUserId: delegation.delegatorUserId,
        delegateeUserId: delegation.delegateeUserId,
        ...(delegation.reason.length > 0 ? { reason: delegation.reason } : {}),
      });
      setDelegation({ delegatorUserId: '', delegateeUserId: '', reason: '' });
      delegations.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'The delegation could not be saved.',
      );
    }
  }, [delegation, delegations]);

  return (
    <PageBody>
      <PageHeader
        title="Approval authority"
        description="Approval limits and temporary delegation of approval rights."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Authority rules</CardTitle>
          <CardDescription>Who may approve, and up to what amount.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {authorities.loading ? (
            <Skeleton className="h-12 w-full" />
          ) : (authorities.data ?? []).length === 0 ? (
            <EmptyState title="No authority rules are configured" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(authorities.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {row.subjectType}: {row.subjectId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.resource ?? 'all resources'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {row.maxAmount !== null
                        ? `${row.maxAmount} ${row.currencyCode ?? ''}`
                        : 'No limit'}
                    </Badge>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void platformApi.deleteAuthority(row.id).then(authorities.reload)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-subject-type">Subject</Label>
              <select
                id="rule-subject-type"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={rule.subjectType}
                onChange={(event) =>
                  setRule((c) => ({ ...c, subjectType: event.currentTarget.value }))
                }
              >
                <option value="ROLE">Role</option>
                <option value="USER">User</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-subject">Subject id</Label>
              <Input
                id="rule-subject"
                value={rule.subjectId}
                onChange={(event) =>
                  setRule((c) => ({ ...c, subjectId: event.currentTarget.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-amount">Max amount</Label>
              <Input
                id="rule-amount"
                inputMode="decimal"
                value={rule.maxAmount}
                onChange={(event) =>
                  setRule((c) => ({ ...c, maxAmount: event.currentTarget.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void submitRule()} disabled={rule.subjectId.length === 0}>
                Add rule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delegations</CardTitle>
          <CardDescription>Temporary transfer of approval authority.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {delegations.loading ? (
            <Skeleton className="h-12 w-full" />
          ) : (delegations.data ?? []).length === 0 ? (
            <EmptyState title="No delegations are active" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(delegations.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between py-3">
                  <span className="text-sm">
                    <span className="font-mono text-xs">{row.delegatorUserId}</span> →{' '}
                    <span className="font-mono text-xs">{row.delegateeUserId}</span>
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void platformApi.deleteDelegation(row.id).then(delegations.reload)
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="delegator">Delegator id</Label>
              <Input
                id="delegator"
                value={delegation.delegatorUserId}
                onChange={(event) =>
                  setDelegation((c) => ({
                    ...c,
                    delegatorUserId: event.currentTarget.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="delegatee">Delegatee id</Label>
              <Input
                id="delegatee"
                value={delegation.delegateeUserId}
                onChange={(event) =>
                  setDelegation((c) => ({
                    ...c,
                    delegateeUserId: event.currentTarget.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="delegation-reason">Reason</Label>
              <Input
                id="delegation-reason"
                value={delegation.reason}
                onChange={(event) =>
                  setDelegation((c) => ({ ...c, reason: event.currentTarget.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => void submitDelegation()}
                disabled={
                  delegation.delegatorUserId.length === 0 || delegation.delegateeUserId.length === 0
                }
              >
                Add delegation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageBody>
  );
}
