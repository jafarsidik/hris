'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
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

export interface RecordRowView {
  readonly employeeId: string;
  readonly employeeName: string;
  /** Shown under the name; omit for non-employee lists. */
  readonly employeeNumber?: string;
  /** Rendered cell values (strings), matching `columns`. */
  readonly cells: readonly string[];
}

export interface RecordTableParams {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly RecordRowView[];
  /** Label of the first column; the row's name (and sub-line) sit under it. */
  readonly firstColumn?: string;
}

/**
 * Generic employee sub-record table used by the Employee Data screens
 * (family, dependents, contacts, education, experience, skills,
 * certifications, documents). Each page pre-shapes its records into
 * string cells so one type-safe table serves all of them.
 */
export function RecordTableScreen({ table }: { table: RecordTableParams }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader title={table.title} description={table.description} />
      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <CardDescription>
            {table.rows.length} record{table.rows.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {table.rows.length === 0 ? (
            <EmptyState title="No records yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{table.firstColumn ?? 'Employee'}</TableHead>
                  {table.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row) => (
                  <TableRow key={row.employeeId + row.cells[0]}>
                    <TableCell>
                      <div className="font-medium">{row.employeeName}</div>
                      {row.employeeNumber === undefined ? null : (
                        <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                      )}
                    </TableCell>
                    {row.cells.map((cell, index) => (
                      <TableCell key={index} className="text-sm">
                        {cell === '' ? '—' : cell}
                      </TableCell>
                    ))}
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
