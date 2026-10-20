import type { Metadata } from 'next';

import { PageBody } from '@/components/layout/page-body';
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
import { mockContracts, mockMovements, type RecordRowView } from '@/features/employment';

export const metadata: Metadata = { title: 'Employee Movement' };

const TYPE_LABEL: Record<string, string> = {
  TRANSFER: 'Transfer',
  PROMOTION: 'Promotion',
  CHANGE: 'Change',
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}

function fmtNullable(iso: string | null): string {
  return iso === null
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}

/**
 * The single workforce "Employment" surface: every movement plus the probation
 * confirmation queue. Transfers, promotions and other job changes are cells of
 * the same event type here, and probation windows ride along as the queue that
 * movement decisions answer.
 */
export default async function EmployeeMovementPage() {
  const movements = mockMovements();

  const movementRows: RecordRowView[] = movements.items.map((row) => ({
    id: row.employeeId,
    employeeName: row.employeeName,
    employeeNumber: row.employeeNumber,
    cells: [
      TYPE_LABEL[row.movementType] ?? row.movementType,
      `${row.fromUnitName ?? '—'} / ${row.fromPositionName ?? '—'}`,
      `${row.toUnitName ?? '—'} / ${row.toPositionName ?? '—'}`,
      fmt(row.effectiveDate),
    ],
  }));

  // Probation confirmations due within the shown horizon, seen through
  // probational contracts.
  const HORIZON_DAYS = 90;
  const now = Date.now();
  const probation = mockContracts('PROBATION');

  const probationRows: RecordRowView[] = probation.items.map((row) => {
    const ends = row.endDate === null ? null : new Date(row.endDate).getTime();
    const daysLeft = ends === null ? null : Math.round((ends - now) / (1000 * 60 * 60 * 24));
    const due =
      daysLeft === null
        ? 'No end date'
        : daysLeft < 0
          ? 'Overdue'
          : daysLeft <= HORIZON_DAYS
            ? `Due in ${daysLeft} d`
            : 'Later';
    return {
      id: row.employeeId,
      employeeName: row.employeeName,
      employeeNumber: row.employeeNumber,
      cells: [row.contractNumber, fmtNullable(row.startDate), fmtNullable(row.endDate), due],
    };
  });

  return (
    <PageBody>
      <PageHeader
        title="Employee Movement"
        description="Transfers, promotions, organizational changes and the probation confirmation queue, in one working view."
      />

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
          <CardDescription>
            {movementRows.length} movement{movementRows.length === 1 ? '' : 's'} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movementRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From unit / position</TableHead>
                  <TableHead>To unit / position</TableHead>
                  <TableHead>Effective</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementRows.map((row) => (
                  <TableRow key={`${row.id}-${row.cells[3]}`}>
                    <TableCell>
                      <div className="font-medium">{row.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                    </TableCell>
                    {row.cells.map((cell, index) => (
                      <TableCell key={index} className="text-sm">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Probation confirmations</CardTitle>
          <CardDescription>
            {probationRows.length} probation contract{probationRows.length === 1 ? '' : 's'} with
            their decision window
          </CardDescription>
        </CardHeader>
        <CardContent>
          {probationRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No probation contracts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Window ends</TableHead>
                  <TableHead>Confirmation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {probationRows.map((row) => (
                  <TableRow key={`${row.id}-${row.cells[0]}`}>
                    <TableCell>
                      <div className="font-medium">{row.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                    </TableCell>
                    {row.cells.map((cell, index) => (
                      <TableCell key={index} className="text-sm">
                        {cell}
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
