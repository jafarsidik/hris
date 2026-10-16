import type { ScheduledActionAction, ScheduledActionSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export type { ScheduledActionAction };

export interface CreateScheduledActionInput {
  readonly name: string;
  readonly description?: string | null;
  readonly cron: string;
  readonly action: ScheduledActionAction;
  readonly isEnabled?: boolean;
}

export interface UpdateScheduledActionInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly cron?: string;
  readonly action?: ScheduledActionAction;
  readonly isEnabled?: boolean;
}

export const scheduledActionsApi = {
  list: (): Promise<readonly ScheduledActionSummary[]> => apiRequestV1('/scheduled-actions'),
  get: (id: string) =>
    apiRequestV1<ScheduledActionSummary>(`/scheduled-actions/${encodeURIComponent(id)}`),
  create: (input: CreateScheduledActionInput) =>
    apiRequestV1<ScheduledActionSummary>('/scheduled-actions', { method: 'POST', body: input }),
  update: (id: string, patch: UpdateScheduledActionInput) =>
    apiRequestV1<ScheduledActionSummary>(`/scheduled-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/scheduled-actions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggle: (id: string, isEnabled: boolean) =>
    apiRequestV1<ScheduledActionSummary>(`/scheduled-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { isEnabled },
    }),
  runNow: (id: string) =>
    apiRequestV1<{ ok: boolean; error?: string }>(
      `/scheduled-actions/${encodeURIComponent(id)}/run`,
      {
        method: 'POST',
      },
    ),
};
