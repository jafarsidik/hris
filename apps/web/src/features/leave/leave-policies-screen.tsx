'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSession } from '@/features/auth/session-context';

import type { LeavePolicy } from './leave-types';

/**
 * Leave Policies: how many days of each leave type an employee earns per
 * year and whether unused days carry forward.
 */
export function LeavePoliciesScreen({ rows }: { rows: readonly LeavePolicy[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Leave Policies"
        description="Entitlement per leave type — annual days and carry-forward rules."
      />
      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
          <CardDescription>{rows.length} policy(ies)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave policies defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave type</TableHead>
                  <TableHead className="text-center">Annual days</TableHead>
                  <TableHead>Carry forward</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.leaveTypeName}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.annualDays}
                    </TableCell>
                    <TableCell>
                      {row.carryForward ? (
                        <Badge variant="secondary">Carries forward</Badge>
                      ) : (
                        <Badge variant="outline">Use it or lose it</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
