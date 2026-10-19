import { mockPayrollRepository } from './mock-payroll-repository';
import { PayrollPeriodsScreen } from './payroll-periods-screen';
import { PayrollRunsScreen } from './payroll-runs-screen';

export function getPayrollRepository() {
  return mockPayrollRepository;
}

export { PayrollPeriodsScreen, PayrollRunsScreen };

export type {
  PayrollPeriod,
  PayrollPeriodPage,
  PayrollRepository,
  PayrollRun,
  PayrollRunPage,
  PayrollRunQuery,
  SalaryStructure,
  SalaryStructurePage,
} from './payroll-types';
