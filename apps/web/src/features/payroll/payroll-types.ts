import type { PageParams, Paginated } from '@hris/shared-types';

export interface PayrollPeriod {
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

export interface SalaryStructure {
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

export interface PayrollRun {
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

export interface PayrollRunQuery {
  readonly periodId?: string;
  readonly employeeId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

export type PayrollRunPage = Paginated<PayrollRun>;
export type PayrollPeriodPage = Paginated<PayrollPeriod>;
export type SalaryStructurePage = Paginated<SalaryStructure>;

export interface PayrollRepository {
  listPeriods(query: { readonly search?: string }): Promise<PayrollPeriodPage>;
  listRuns(query: PayrollRunQuery): Promise<PayrollRunPage>;
  listSalaryStructures(): Promise<SalaryStructurePage>;
}
