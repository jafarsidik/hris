import type { Paginated } from '@hris/shared-types';

export interface PerformanceCycle {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PerformanceGoal {
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

export interface PerformanceReview {
  readonly id: string;
  readonly cycleId: string;
  readonly cycleName: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly reviewRating: number | null;
  readonly reviewSummary: string | null;
  readonly status: string;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type GoalPage = Paginated<PerformanceGoal>;
export type ReviewPage = Paginated<PerformanceReview>;
export type CyclePage = Paginated<PerformanceCycle>;

export interface PerformanceRepository {
  listCycles(): Promise<CyclePage>;
  listGoals(): Promise<GoalPage>;
  listReviews(): Promise<ReviewPage>;
}
