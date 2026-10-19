import type { PageParams } from '../common/pagination';

/** One approved headcount request the company is hiring for. */
export interface JobRequisitionSummary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly positionId: string | null;
  readonly positionTitle: string | null;
  readonly department: string | null;
  readonly headcount: number;
  readonly status: string;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One external person in the candidate pool. */
export interface JobCandidateSummary {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly source: string | null;
  readonly resumeSummary: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A candidate's application to one requisition, with its pipeline stage. */
export interface JobApplicationSummary {
  readonly id: string;
  readonly requisitionId: string;
  readonly requisitionCode: string;
  readonly requisitionTitle: string;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly candidateEmail: string;
  readonly stage: string;
  readonly rating: number | null;
  readonly notes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields used to create a requisition. */
export interface CreateJobRequisitionInput {
  readonly code: string;
  readonly title: string;
  readonly positionId: string | null;
  readonly department: string | null;
  readonly headcount: number;
}

/** Fields used to create a candidate. */
export interface CreateJobCandidateInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly source: string | null;
  readonly resumeSummary: string | null;
}

/** Fields used to create an application, or move it to a new stage. */
export interface CreateJobApplicationInput {
  readonly requisitionId: string;
  readonly candidateId: string;
  readonly notes: string | null;
}

/** Requisition list query. */
export interface JobRequisitionQuery {
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

/** Application list query. */
export interface JobApplicationQuery {
  readonly requisitionId?: string;
  readonly stage?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
