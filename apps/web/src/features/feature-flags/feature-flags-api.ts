import type { FeatureFlagSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const featureFlagsApi = {
  list: (): Promise<readonly FeatureFlagSummary[]> => apiRequestV1('/feature-flags'),
  resolve: () =>
    apiRequestV1<readonly { key: string; enabled: boolean }[]>('/feature-flags/resolve'),
  create: (input: {
    key: string;
    name: string;
    description?: string | null;
    enabled?: boolean;
    rollout?: Record<string, unknown>;
  }) => apiRequestV1<FeatureFlagSummary>('/feature-flags', { method: 'POST', body: input }),
  update: (
    id: string,
    patch: {
      key?: string;
      name?: string;
      description?: string;
      enabled?: boolean;
      rollout?: Record<string, unknown>;
    },
  ) =>
    apiRequestV1<FeatureFlagSummary>(`/feature-flags/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/feature-flags/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggle: (id: string, enabled: boolean) =>
    apiRequestV1<FeatureFlagSummary>(`/feature-flags/${id}/toggle`, {
      method: 'POST',
      body: { enabled },
    }),
};
