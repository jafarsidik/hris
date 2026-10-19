import type { PageParams } from '../common/pagination';

/** One exit case for a departing employee. */
export interface OffboardingCaseSummary {
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

/** One clearance checklist line within an exit case. */
export interface OffboardingChecklistItemSummary {
  readonly id: string;
  readonly caseId: string;
  readonly task: string;
  readonly isDone: boolean;
  readonly completedAt: string | null;
}

/** Fields used to create an exit case (checklist seeded by the API). */
export interface CreateOffboardingCaseInput {
  readonly employeeId: string;
  readonly reason: string;
  readonly lastWorkingDate: string;
  readonly exitInterviewNotes?: string | null;
}

/** Offboarding case list query. */
export interface OffboardingCaseQuery {
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
