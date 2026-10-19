import type { Metadata } from 'next';

import { PayrollRunsScreen, getPayrollRepository } from '@/features/payroll';

export const metadata: Metadata = { title: 'Payroll' };

export default async function PayrollRunsPage() {
  const repository = getPayrollRepository();
  const [runs, periods, salaryStructures] = await Promise.all([
    repository.listRuns({}),
    repository.listPeriods({}),
    repository.listSalaryStructures(),
  ]);

  return (
    <PayrollRunsScreen
      initialRows={runs.items}
      periods={periods.items}
      salaryStructures={salaryStructures.items.map((structure) => ({
        positionTitle: structure.positionTitle,
        baseSalary: structure.baseSalary,
        currency: structure.currency,
      }))}
    />
  );
}
