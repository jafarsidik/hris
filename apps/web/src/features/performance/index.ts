import { mockPerformanceRepository } from './mock-performance-repository';
import { PerformanceScreen } from './performance-screen';

export function getPerformanceRepository() {
  return mockPerformanceRepository;
}

export { PerformanceScreen };

export type {
  CyclePage,
  GoalPage,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceRepository,
  PerformanceReview,
  ReviewPage,
} from './performance-types';
