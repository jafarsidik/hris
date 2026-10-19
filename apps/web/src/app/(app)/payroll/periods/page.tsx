import type { Metadata } from 'next';

import { PayrollPeriodsScreen, getPayrollRepository } from '@/features/payroll';

export const metadata: Metadata = { title: 'Payroll Periods' };

export default async function PayrollPeriodsPage() {
  const repository = getPayrollRepository();
  const periods = await repository.listPeriods({});

  return <PayrollPeriodsScreen rows={periods.items} />;
}
