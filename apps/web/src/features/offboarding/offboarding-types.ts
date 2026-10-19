import type { Paginated } from '@hris/shared-types';

export interface OffboardingCase {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly reason: string;
  readonly lastWorkingDate: string;
  readonly status: string;
  readonly exitInterviewNotes: string | null;
  readonly checklistTotal: number;
  readonly checklistDone: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OffboardingCasePage = Paginated<OffboardingCase>;
