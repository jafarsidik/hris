import type { PageParams } from '../common/pagination';
import type { RecordEmployeeRead } from './records';

/** A signed employment agreement. */
export interface EmploymentContractSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly contractNumber: string;
  readonly contractType: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: string;
  readonly signedDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An organizational movement (transfer, promotion or role change). */
export interface EmployeeMovementSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly movementType: string;
  readonly effectiveDate: string;
  readonly fromUnitName: string | null;
  readonly toUnitName: string | null;
  readonly fromPositionName: string | null;
  readonly toPositionName: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateEmploymentContractInput {
  readonly employeeId: string;
  readonly contractNumber: string;
  readonly contractType: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: string;
  readonly signedDate: string | null;
  readonly notes: string | null;
}

export interface UpdateEmploymentContractInput {
  readonly contractNumber?: string;
  readonly contractType?: string;
  readonly startDate?: string;
  readonly endDate?: string | null;
  readonly status?: string;
  readonly signedDate?: string | null;
  readonly notes?: string | null;
}

export interface CreateEmployeeMovementInput {
  readonly employeeId: string;
  readonly movementType: string;
  readonly effectiveDate: string;
  readonly fromUnitName: string | null;
  readonly toUnitName: string | null;
  readonly fromPositionName: string | null;
  readonly toPositionName: string | null;
  readonly reason: string | null;
}

export interface UpdateEmployeeMovementInput {
  readonly movementType?: string;
  readonly effectiveDate?: string;
  readonly fromUnitName?: string | null;
  readonly toUnitName?: string | null;
  readonly fromPositionName?: string | null;
  readonly toPositionName?: string | null;
  readonly reason?: string | null;
}

export interface EmploymentQuery {
  readonly employeeId?: string;
  readonly type?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
