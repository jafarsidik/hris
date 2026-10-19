import type { PageParams } from '../common/pagination';

/** One review cycle window. */
export interface PerformanceCycleSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One employee goal within a cycle. */
export interface PerformanceGoalSummary {
  readonly id: string;
  readonly cycleId: string;
  readonly cycleName: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly title: string;
  readonly description: string | null;
  readonly weight: number;
  readonly progress: number;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One manager appraisal per employee per cycle. */
export interface PerformanceReviewSummary {
  readonly id: string;
  readonly cycleId: string;
  readonly cycleName: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly reviewerUserId: string | null;
  readonly rating: number | null;
  readonly summary: string | null;
  readonly status: string;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields used to create a cycle. */
export interface CreatePerformanceCycleInput {
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
}

/** Fields used to create a goal. */
export interface CreatePerformanceGoalInput {
  readonly cycleId: string;
  readonly employeeId: string;
  readonly title: string;
  readonly description: string | null;
  readonly weight: number;
}

/** Fields used to create a review. */
export interface CreatePerformanceReviewInput {
  readonly cycleId: string;
  readonly employeeId: string;
  readonly rating: number | null;
  readonly summary: string | null;
}

/** Goal list query. */
export interface PerformanceGoalQuery {
  readonly cycleId?: string;
  readonly employeeId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

/** Review list query. */
export interface PerformanceReviewQuery {
  readonly cycleId?: string;
  readonly status?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
