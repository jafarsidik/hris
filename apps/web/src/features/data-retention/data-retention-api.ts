import type { DataRetentionScheduleInput, DataRetentionScheduleSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const dataRetentionApi = {
  list: (): Promise<readonly DataRetentionScheduleSummary[]> => apiRequestV1('/data-retention'),
  create: (input: DataRetentionScheduleInput) =>
    apiRequestV1<DataRetentionScheduleSummary>('/data-retention', { method: 'POST', body: input }),
  update: (id: string, patch: Partial<DataRetentionScheduleInput>) =>
    apiRequestV1<DataRetentionScheduleSummary>(`/data-retention/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/data-retention/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggle: (id: string, isEnabled: boolean) =>
    apiRequestV1<DataRetentionScheduleSummary>(`/data-retention/${id}/toggle`, {
      method: 'POST',
      body: { isEnabled },
    }),
};
