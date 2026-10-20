import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { PageBody } from '@/components/layout/page-body';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getEmployeeRepository } from '@/features/employees';
import { EmployeeProfileActions } from '@/features/employees/employee-profile-actions';
import { describeStatus, formatApiHireDate } from '@/features/employees/employee-presentation';
import { EmployeePhotoField } from '@/features/employees/employee-photo-field';
import type { Employee } from '@/features/employees/employee-types';
import {
  AccountPanel,
  AttendancePanel,
  KvItem,
  PayrollPanel,
  ProfileTabs,
  RecordSection,
  profileSectionsFor,
  profileExtrasFor,
} from '@/features/employee-detail';
import type { ProfileSections, ProfileExtras } from '@/features/employee-detail';

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

  const sections = await profileSectionsFor(employee.id);
  const extras = profileExtrasFor(employee.id, employee, new Date());

  return <ProfileBody employee={employee} sections={sections} extras={extras} />;
}

function ProfileBody({
  employee,
  sections,
  extras,
}: {
  employee: Employee;
  sections: ProfileSections;
  extras: ProfileExtras;
}) {
  const status = describeStatus(employee.status);

  return (
    <PageBody>
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/employees" />}>Employees</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{employee.employeeNumber}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{employee.fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Employee records are live</AlertTitle>
        <AlertDescription>
          Identity, employment and personal-data sections read from the API and the database.
          Attendance, payroll and account values remain illustrative samples until those modules go
          live.
        </AlertDescription>
      </Alert>

      {/*
        Reference layout: identity card on the left, tabbed detail card on
        the right; on narrow screens the sidebar stacks on top.
      */}
      <div className="grid items-start gap-5 lg:grid-cols-[290px_1fr]">
        <Card className="p-6 text-center lg:sticky lg:top-[72px]">
          <EmployeeIdentityColumn employee={employee} status={status} extras={extras} />
        </Card>

        <Card className="gap-0 p-0">
          <div className="p-5 lg:p-6">
            <ProfileTabs
              tabs={[
                {
                  value: 'overview',
                  label: 'Overview',
                  content: <OverviewPanel employee={employee} extras={extras} />,
                },
                {
                  value: 'employment',
                  label: 'Employment',
                  content: (
                    <EmploymentPanel employee={employee} sections={sections} extras={extras} />
                  ),
                },
                {
                  value: 'personal',
                  label: 'Personal Data',
                  content: <PersonalPanel sections={sections} />,
                },
                {
                  value: 'attendance',
                  label: 'Attendance',
                  content: <AttendancePanel attendance={extras.attendance} />,
                },
                {
                  value: 'payroll',
                  label: 'Payroll',
                  content: <PayrollPanel payroll={extras.payroll} />,
                },
                {
                  value: 'account',
                  label: 'Account',
                  content: <AccountPanel account={extras.account} />,
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </PageBody>
  );
}

function EmployeeIdentityColumn({
  employee,
  status,
  extras,
}: {
  employee: Employee;
  status: ReturnType<typeof describeStatus>;
  extras: ProfileExtras;
}) {
  return (
    <div>
      <div className="flex justify-center">
        <EmployeePhotoField employeeId={employee.id} fullName={employee.fullName} compact />
      </div>

      <h1 className="mt-3 text-xl font-semibold">{employee.fullName}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{employee.jobTitle}</p>

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{employee.employmentType}</Badge>
      </div>

      <dl className="mt-5 space-y-3 border-t border-border pt-4 text-left text-sm">
        <ContactRow label="Employee number">
          <span className="tabular-nums">{employee.employeeNumber}</span>
        </ContactRow>
        <ContactRow label="Email">
          <a
            className="block truncate text-primary underline-offset-2 hover:underline"
            href={`mailto:${employee.email}`}
            title={employee.email}
          >
            {employee.email}
          </a>
        </ContactRow>
        <ContactRow label="Phone">
          <span className="tabular-nums">{extras.phone}</span>
        </ContactRow>
        <ContactRow label="Work location">{extras.workLocation}</ContactRow>
      </dl>

      <div className="mt-5 flex justify-center gap-2 [&>*]:flex-1">
        <EmployeeProfileActions employee={employee} />
      </div>
    </div>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <small className="block text-xs text-muted-foreground">{label}</small>
      {children}
    </div>
  );
}

function OverviewPanel({ employee, extras }: { employee: Employee; extras: ProfileExtras }) {
  const stats = [
    { value: extras.tenureLabel, label: 'Tenure' },
    { value: `${extras.attendance.attendancePct}%`, label: 'Attendance this month' },
    { value: `${extras.leaveRemaining} days`, label: 'Remaining annual leave' },
    { value: extras.performanceLabel, label: 'Latest performance review' },
  ];

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-muted/50 p-3.5">
            <b className="block text-lg font-semibold tabular-nums">{stat.value}</b>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-base font-semibold">Summary</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <KvItem label="Department">{employee.department}</KvItem>
          <KvItem label="Direct supervisor">{extras.supervisor}</KvItem>
          <KvItem label="Join date">{formatApiHireDate(employee.hireDate)}</KvItem>
          <KvItem label="Employment status">{employee.employmentType}</KvItem>
        </dl>
      </section>

      <section className="border-t border-border pt-5">
        <h2 className="mb-4 text-base font-semibold">Recent activity</h2>
        <ul className="ml-2.5 space-y-0 border-l-2 border-border pl-5">
          {extras.activity.map((item, index) => (
            <Fragment key={`${item.title}-${item.date}`}>
              <li className={index === 0 ? 'relative pb-4' : 'relative pb-4 last:pb-0'}>
                <span
                  aria-hidden="true"
                  className="absolute -left-[23px] top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                />
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.date}</div>
              </li>
            </Fragment>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmploymentPanel({
  employee,
  sections,
  extras,
}: {
  employee: Employee;
  sections: ProfileSections;
  extras: ProfileExtras;
}) {
  return (
    <div className="flex flex-col">
      <section>
        <h2 className="mb-4 text-base font-semibold">Employment information</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <KvItem label="Job title">{employee.jobTitle}</KvItem>
          <KvItem label="Department">{employee.department}</KvItem>
          <KvItem label="Grade">{extras.grade}</KvItem>
          <KvItem label="Employee status">{employee.employmentType}</KvItem>
          <KvItem label="Join date">{formatApiHireDate(employee.hireDate)}</KvItem>
          <KvItem label="Confirmed on">{extras.confirmedOn}</KvItem>
          <KvItem label="Direct supervisor">{extras.supervisor}</KvItem>
          <KvItem label="Work pattern">{extras.workPattern}</KvItem>
        </dl>
      </section>

      {sections.employment.map((section) => (
        <RecordSection key={section.title} {...section} />
      ))}
    </div>
  );
}

function PersonalPanel({ sections }: { sections: ProfileSections }) {
  return (
    <div className="flex flex-col">
      {sections.personal.map((section) => (
        <RecordSection key={section.title} {...section} />
      ))}
    </div>
  );
}
