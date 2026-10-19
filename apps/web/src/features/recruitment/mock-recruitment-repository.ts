import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type {
  ApplicationPage,
  JobApplication,
  JobApplicationQuery,
  JobRequisition,
  RequisitionPage,
  RecruitmentRepository,
} from './recruitment-types';

const REQUISITIONS: readonly JobRequisition[] = Object.freeze([
  {
    id: 'req-0001',
    code: 'REQ-2026-041',
    title: 'Senior Backend Engineer',
    positionTitle: 'Software Engineer',
    department: 'Engineering',
    headcount: 2,
    status: 'OPEN',
    openedAt: '2026-10-02T00:00:00Z',
    closedAt: null,
    createdAt: '2026-09-28T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
  },
  {
    id: 'req-0002',
    code: 'REQ-2026-042',
    title: 'People Operations Specialist',
    positionTitle: 'People Operations Lead',
    department: 'People',
    headcount: 1,
    status: 'FILLED',
    openedAt: '2026-08-11T00:00:00Z',
    closedAt: null,
    createdAt: '2026-08-08T00:00:00Z',
    updatedAt: '2026-10-12T00:00:00Z',
  },
] as const);

const APPLICATIONS: readonly JobApplication[] = Object.freeze([
  {
    id: 'app-0001',
    requisitionId: 'req-0001',
    requisitionCode: 'REQ-2026-041',
    requisitionTitle: 'Senior Backend Engineer',
    candidateId: 'cand-0001',
    candidateName: 'Nadia Pramudita',
    candidateEmail: 'nadia.p@example.com',
    stage: 'INTERVIEW',
    rating: 4,
    notes: 'Strong system design background.',
    decidedAt: null,
    createdAt: '2026-10-05T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  },
  {
    id: 'app-0002',
    requisitionId: 'req-0001',
    requisitionCode: 'REQ-2026-041',
    requisitionTitle: 'Senior Backend Engineer',
    candidateId: 'cand-0002',
    candidateName: 'Bimo Santoso',
    candidateEmail: 'bimo.s@example.com',
    stage: 'SCREENING',
    rating: null,
    notes: null,
    decidedAt: null,
    createdAt: '2026-10-14T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z',
  },
  {
    id: 'app-0003',
    requisitionId: 'req-0002',
    requisitionCode: 'REQ-2026-042',
    requisitionTitle: 'People Operations Specialist',
    candidateId: 'cand-0003',
    candidateName: 'Clara Wijaya',
    candidateEmail: 'clara.w@example.com',
    stage: 'HIRED',
    rating: 5,
    notes: 'Offer accepted.',
    decidedAt: '2026-10-12T00:00:00Z',
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-10-12T00:00:00Z',
  },
] as const);

class MockRecruitmentRepository implements RecruitmentRepository {
  async listRequisitions(query: {
    readonly status?: string;
    readonly search?: string;
  }): Promise<RequisitionPage> {
    const params = normalisePageParams({});
    const filters = { status: query.status ?? '', search: query.search?.trim() ?? '' };
    const fingerprint = cursorFingerprint({ filters, sort: SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    let filtered = [...REQUISITIONS];
    if (filters.status) filtered = filtered.filter((r) => r.status === filters.status);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.code.toLowerCase().includes(needle) ||
          (r.department ?? '').toLowerCase().includes(needle),
      );
    }
    return buildPage(filtered, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async listApplications(query: JobApplicationQuery): Promise<ApplicationPage> {
    const params = normalisePageParams({});
    const filters = {
      requisitionId: query.requisitionId ?? '',
      stage: query.stage ?? '',
      search: query.search?.trim() ?? '',
    };
    const fingerprint = cursorFingerprint({ filters, sort: SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    const ordered = [...APPLICATIONS].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    let filtered = ordered;
    if (filters.requisitionId) {
      filtered = filtered.filter((a) => a.requisitionId === filters.requisitionId);
    }
    if (filters.stage) filtered = filtered.filter((a) => a.stage === filters.stage);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.candidateName.toLowerCase().includes(needle) ||
          a.requisitionTitle.toLowerCase().includes(needle),
      );
    }
    return buildPage(filtered, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }
}

const SORT = { createdAt: 'desc', id: 'desc' } as const;

export const mockRecruitmentRepository: RecruitmentRepository = new MockRecruitmentRepository();
