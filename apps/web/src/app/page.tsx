import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Users, UserCheck, UserMinus, Building2 } from 'lucide-react';
import { HrSampleCard } from '@/features/dashboard/hr-sample-card';
import { MetricCard } from '@/features/dashboard/metric-card';
import { ModuleProgress } from '@/features/dashboard/module-progress';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { RecentHires } from '@/features/dashboard/recent-hires';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const metadata: Metadata = {
  title: 'Command Center',
};

/**
 * The HR command center.
 *
 * Headline numbers come from the same (mock) repository the directory reads, so the
 * dashboard and the directory can never disagree about a count while still sharing one
 * data path. Every figure is labeled with its basis, and the "sample data" alert makes
 * the source of the numbers impossible to miss — there is no database behind them yet.
 *
 * The platform-foundation notes from earlier phases remain on this page inside the
 * accordion at the bottom, so the engineering baseline is one click away instead of
 * gone.
 */
export default async function CommandCenterPage() {
  const directory = await getEmployeeRepository().list({
    sort: 'hireDate',
    page: { limit: MAX_PAGE_SIZE },
  });

  const employees = directory.items;
  const total = employees.length;
  const active = employees.filter((employee) => employee.status === 'ACTIVE').length;
  const attention = employees.filter(
    (employee) => employee.status === 'ON_LEAVE' || employee.status === 'PROBATION',
  ).length;
  const departments = new Set(employees.map((employee) => employee.department)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Headcount, recent hires and platform status at a glance."
      />

      {/*
        The same honesty note the directory carries: these numbers are computed locally
        from generated records, not served by an employee endpoint.
      */}
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Sample data</AlertTitle>
        <AlertDescription>
          Every figure below is computed from {total} generated records in memory. They reset each
          time the server restarts, and nothing here is wired to a database.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Headcount"
          value={total}
          sub={`across ${departments} departments`}
          icon={Users}
        />
        <MetricCard label="Active" value={active} sub={`of ${total} records`} icon={UserCheck} />
        <MetricCard
          label="Needs attention"
          value={attention}
          sub="on leave or probation"
          icon={UserMinus}
        />
        <MetricCard
          label="Departments"
          value={departments}
          sub="in the sample directory"
          icon={Building2}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentHires employees={employees} />
        </div>

        <div className="space-y-6">
          <QuickActions />
          <HrSampleCard employees={employees} />
        </div>
      </div>

      <ModuleProgress />

      <Accordion multiple>
        <AccordionItem value="foundation">
          <AccordionTrigger>Platform foundation</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-6 md:grid-cols-3">
              <section>
                <h3 className="text-sm font-medium">What exists</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The API boots with versioned routing, validated input, standardised responses and
                  health probes; web and mobile clients consume that same API.
                </p>
              </section>

              <section>
                <h3 className="text-sm font-medium">Engineering baseline</h3>
                <ul className="mt-2 list-disc ps-5 text-sm leading-7 text-muted-foreground">
                  <li>Type-safe domain contracts shared by API, web and mobile</li>
                  <li>Server-side authorisation with explicit data scopes</li>
                  <li>Immutable-by-design audit and payroll integrity constraints</li>
                  <li>Lint, typecheck, unit, integration and e2e tests in CI</li>
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-medium">Next steps</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Business capabilities land in phase order — identity and access, organization and
                  core HR, then workflow, attendance, leave, claims, administration, ATS,
                  performance and payroll. See docs/IMPLEMENTATION_PLAN.md.
                </p>
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
