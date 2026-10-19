import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type {
  CyclePage,
  GoalPage,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceRepository,
  PerformanceReview,
  ReviewPage,
} from './performance-types';

const CYCLES: readonly PerformanceCycle[] = Object.freeze([
  {
    id: 'cyc-2026',
    code: 'CY-2026',
    name: 'Performance 2026',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T00:00:00Z',
    status: 'ACTIVE',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
] as const);

const GOALS: readonly PerformanceGoal[] = Object.freeze([
  {
    id: 'goal-0001',
    cycleId: 'cyc-2026',
    cycleName: 'Performance 2026',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    title: 'Ship payroll v1',
    description: 'Deliver the payroll engine to first paying company.',
    weight: 40,
    progress: 70,
    status: 'IN_PROGRESS',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  },
  {
    id: 'goal-0002',
    cycleId: 'cyc-2026',
    cycleName: 'Performance 2026',
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    title: 'Reduce time-to-hire under 30 days',
    description: null,
    weight: 30,
    progress: 100,
    status: 'ACHIEVED',
    createdAt: '2026-02-03T00:00:00Z',
    updatedAt: '2026-09-15T00:00:00Z',
  },
] as const);

const REVIEWS: readonly PerformanceReview[] = Object.freeze([
  {
    id: 'rev-0001',
    cycleId: 'cyc-2026',
    cycleName: 'Performance 2026',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    reviewRating: 4,
    reviewSummary: 'Consistently delivers on schedule.',
    status: 'SUBMITTED',
    submittedAt: '2026-10-12T00:00:00Z',
    createdAt: '2026-10-12T00:00:00Z',
    updatedAt: '2026-10-12T00:00:00Z',
  },
] as const);

const SORT = { createdAt: 'desc', id: 'desc' } as const;
const CYCLE_SORT = { startDate: 'desc', id: 'desc' } as const;

class MockPerformanceRepository implements PerformanceRepository {
  async listCycles(): Promise<CyclePage> {
    const params = normalisePageParams({});
    const fingerprint = cursorFingerprint({ filters: {}, sort: CYCLE_SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    return buildPage([...CYCLES], params, fingerprint, (item) => ({
      values: [item.startDate, item.id],
    }));
  }

  async listGoals(): Promise<GoalPage> {
    const params = normalisePageParams({});
    const fingerprint = cursorFingerprint({ filters: {}, sort: SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    return buildPage([...GOALS], params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async listReviews(): Promise<ReviewPage> {
    const params = normalisePageParams({});
    const fingerprint = cursorFingerprint({ filters: {}, sort: SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    return buildPage([...REVIEWS], params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }
}

export const mockPerformanceRepository: PerformanceRepository = new MockPerformanceRepository();
