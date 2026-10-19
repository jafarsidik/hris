import type { PageParams, Paginated } from '@hris/shared-types';

export interface JobRequisition {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly positionTitle: string | null;
  readonly department: string | null;
  readonly headcount: number;
  readonly status: string;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobApplication {
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

export type JobApplicationQuery = {
  readonly requisitionId?: string;
  readonly stage?: string;
  readonly search?: string;
  readonly page?: PageParams;
};

export type RequisitionPage = Paginated<JobRequisition>;
export type ApplicationPage = Paginated<JobApplication>;

export interface RecruitmentRepository {
  listRequisitions(query: {
    readonly status?: string;
    readonly search?: string;
  }): Promise<RequisitionPage>;
  listApplications(query: JobApplicationQuery): Promise<ApplicationPage>;
}
