import type { Metadata } from 'next';
import { ArrowLeft, Banknote, CalendarClock, FileText, Info, Plane, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEmployeeRepository } from '@/features/employees';
import { EmployeeProfileActions } from '@/features/employees/employee-profile-actions';
import {
  describeStatus,
  formatHireDate,
  initialsFor,
} from '@/features/employees/employee-presentation';
import type { Employee } from '@/features/employees/employee-types';

/** A profile must reflect the store at request time; it is not cacheable. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployeeRepository().getById(id);

  if (employee === null) {
    // A missing record is a missing page. Raising it here (as well as in the page) makes
    // the 404 status part of the response, not just the rendered body.
    notFound();
  }

  return { title: `${employee.fullName} — Employee profile` };
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployeeRepository().getById(id);

  if (employee === null) {
    notFound();
  }

  return <ProfileBody employee={employee} />;
}

/** The probation question, stated for any status rather than defaulting to "Confirmed". */
function statusPhrase(status: Employee['status']): string {
  switch (status) {
    case 'PROBATION':
      return 'In probation';
    case 'ON_LEAVE':
      return 'On leave';
    case 'INACTIVE':
      return 'Inactive';
    default:
      return 'Confirmed';
  }
}

function ProfileBody({ employee }: { employee: Employee }) {
  const initials = initialsFor(employee.fullName);
  const status = describeStatus(employee.status);

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to directory
      </Link>

      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Sample data</AlertTitle>
        <AlertDescription>
          This profile is generated locally, like the rest of the directory. Nothing here comes from
          a real employee record, and edits reset when the server restarts.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {initials !== '' && (
            <div
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl font-semibold text-primary"
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{employee.jobTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {employee.employeeNumber} &middot; {employee.department}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant="outline">{employee.employmentType}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeProfileActions employee={employee} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  <h2>Record</h2>
                </CardTitle>
                <CardDescription>The details the directory stores today</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-sm">
                  <ProfileRow label="Employee number">
                    <span className="tabular-nums">{employee.employeeNumber}</span>
                  </ProfileRow>
                  <ProfileRow label="Department">{employee.department}</ProfileRow>
                  <ProfileRow label="Job title">{employee.jobTitle}</ProfileRow>
                  <ProfileRow label="Employment type">{employee.employmentType}</ProfileRow>
                  <ProfileRow label="Status">{status.label}</ProfileRow>
                  <ProfileRow label="Join date">{formatHireDate(employee.hireDate)}</ProfileRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>At a glance</h2>
                </CardTitle>
                <CardDescription>The essentials without opening a record</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-sm">
                  <ProfileRow label="Email">
                    <a
                      className="truncate text-primary underline-offset-2 hover:underline"
                      href={`mailto:${employee.email}`}
                      title={employee.email}
                    >
                      {employee.email}
                    </a>
                  </ProfileRow>
                  <ProfileRow label="Status phrase">{statusPhrase(employee.status)}</ProfileRow>
                  <ProfileRow label="Join date">{formatHireDate(employee.hireDate)}</ProfileRow>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <PlannedTab
            icon={CalendarClock}
            title="Employment timeline"
            description="Hire date, probation window, and grade history will live here once the employment endpoint ships."
          />
        </TabsContent>

        <TabsContent value="personal">
          <PlannedTab
            icon={UserRound}
            title="Personal details"
            description="The sample records have no personal fields beyond an email, so there is nothing real to show yet."
          />
        </TabsContent>

        <TabsContent value="attendance">
          <PlannedTab
            icon={Plane}
            title="Attendance & leave"
            description="Leave balances and the absence calendar will be surfaced from the attendance module."
          />
        </TabsContent>

        <TabsContent value="payroll">
          <PlannedTab
            icon={Banknote}
            title="Payroll"
            description="Salary, payslips, and tax settings appear with the payroll module."
          />
        </TabsContent>

        <TabsContent value="documents">
          <PlannedTab
            icon={FileText}
            title="Documents"
            description="Contracts and onboarding paperwork will be listed here from the documents store."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/** Honest placeholder for the sections a later phase fills with real modules. */
function PlannedTab({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            {title}
          </span>
        </CardTitle>
        <CardDescription>Planned — this section is not part of the current build.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
