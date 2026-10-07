import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  describeStatus,
  formatHireDate,
  initialsFor,
} from '@/features/employees/employee-presentation';
import type { Employee } from '@/features/employees/employee-types';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

/**
 * The most recent additions to the directory.
 *
 * Rendering is deterministic: the rows arrive sorted by hire date, the eight newest ones
 * are flipped to newest-first, and the table is just the presentation of those rows. The
 * "View all" action reuses the same link the sidebar uses, so there is one canonical
 * path to the directory.
 */
export function RecentHires({ employees }: { employees: readonly Employee[] }) {
  const recent = [...employees].reverse().slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>
            <h2>Recent hires</h2>
          </CardTitle>
          <CardDescription>The newest records in the directory</CardDescription>
        </div>
        <ButtonAsLink />
      </CardHeader>
      <CardContent className="p-0">
        <Table containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead className="hidden sm:table-cell">Department</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((employee) => {
              const status = describeStatus(employee.status);
              const initials = initialsFor(employee.fullName);

              return (
                <TableRow key={employee.id}>
                  <TableCell className="max-w-[16rem] pl-4">
                    <div className="flex items-center gap-3">
                      {initials !== '' && (
                        <Avatar aria-hidden="true" className="size-7 shrink-0">
                          <AvatarFallback className="text-[11px] font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0">
                        <span className="block truncate font-medium" title={employee.fullName}>
                          {employee.fullName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground sm:hidden">
                          {employee.jobTitle}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className="hidden max-w-[11rem] truncate sm:table-cell"
                    title={employee.department}
                  >
                    {employee.department}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">
                    {formatHireDate(employee.hireDate)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ButtonAsLink() {
  return (
    <Button variant="outline" size="sm" render={<Link href="/employees" />}>
      View all
      <ArrowRight aria-hidden="true" className="size-3.5" />
    </Button>
  );
}
