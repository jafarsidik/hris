import type { AccessReviewItemSummary, AccessReviewSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface AccessReviewDetail extends AccessReviewSummary {
  readonly items: readonly AccessReviewItemSummary[];
}

export const accessReviewsApi = {
  list: (): Promise<readonly AccessReviewSummary[]> => apiRequestV1('/access-reviews'),
  get: (id: string) =>
    apiRequestV1<AccessReviewDetail>(`/access-reviews/${encodeURIComponent(id)}`),
  create: (input: {
    readonly name: string;
    readonly description?: string | null;
    readonly reviewerId?: string;
    readonly dueAt?: string;
  }) => apiRequestV1<AccessReviewSummary>('/access-reviews', { method: 'POST', body: input }),
  update: (
    id: string,
    patch: {
      readonly name?: string;
      readonly description?: string | null;
      readonly reviewerId?: string;
      readonly dueAt?: string;
    },
  ) =>
    apiRequestV1<AccessReviewSummary>(`/access-reviews/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/access-reviews/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  decide: (reviewId: string, itemId: string, decision: string, notes?: string | null) =>
    apiRequestV1<never>(
      `/access-reviews/${encodeURIComponent(reviewId)}/items/${encodeURIComponent(itemId)}/decide`,
      {
        method: 'POST',
        body: { decision, notes: notes ?? null },
      },
    ),
};
