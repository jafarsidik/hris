import type { PageParams } from '../common/pagination';

/** One pay period. */
export interface PayrollPeriodSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly payDate: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Base salary attached to a position. */
export interface SalaryStructureSummary {
  readonly id: string;
  readonly positionId: string;
  readonly positionTitle: string;
  readonly baseSalary: number;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One employee's calculated payroll result for a period. */
export interface PayrollRunSummary {
  readonly id: string;
  readonly periodId: string;
  readonly periodCode: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly baseSalary: number;
  readonly totalEarnings: number;
  readonly totalDeductions: number;
  readonly netPay: number;
  readonly status: string;
  readonly paidAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An earning or deduction line item within a run. */
export interface PayrollComponentSummary {
  readonly id: string;
  readonly runId: string;
  readonly component: string;
  readonly type: string;
  readonly amount: number;
}

/** Fields used to create or update a payroll period. */
export interface CreatePayrollPeriodInput {
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly payDate?: string | null;
}

/** Fields used to create or update a salary structure. */
export interface CreateSalaryStructureInput {
  readonly positionId: string;
  readonly baseSalary: number;
  readonly currency?: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
  readonly isActive?: boolean;
}

/** Fields used to update a payroll run (recalculate totals or change status). */
export interface UpdatePayrollRunInput {
  readonly status?: string;
  readonly components?: readonly {
    readonly component: string;
    readonly type: string;
    readonly amount: number;
  }[];
}

/** Payroll period list query. */
export interface PayrollPeriodQuery {
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

/** Salary structure list query. */
export interface SalaryStructureQuery {
  readonly positionId?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

/** Payroll run list query. */
export interface PayrollRunQuery {
  readonly periodId?: string;
  readonly employeeId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
