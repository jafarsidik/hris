import type { BusinessRuleAction, BusinessRuleSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface CreateBusinessRuleInput {
  readonly name: string;
  readonly description?: string | null;
  readonly eventType: string;
  readonly condition?: Record<string, unknown>;
  readonly actions?: readonly BusinessRuleAction[];
  readonly priority?: number;
  readonly isEnabled?: boolean;
}

export interface UpdateBusinessRuleInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly eventType?: string;
  readonly condition?: Record<string, unknown>;
  readonly actions?: readonly BusinessRuleAction[];
  readonly priority?: number;
  readonly isEnabled?: boolean;
}

const query = (params: Readonly<Record<string, string | number | undefined>>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const rendered = search.toString();
  return rendered.length === 0 ? '' : `?${rendered}`;
};

export const businessRulesApi = {
  list: (filter: { eventType?: string } = {}): Promise<readonly BusinessRuleSummary[]> =>
    apiRequestV1<readonly BusinessRuleSummary[]>(`/business-rules${query(filter)}`),

  get: (id: string): Promise<BusinessRuleSummary> =>
    apiRequestV1<BusinessRuleSummary>(`/business-rules/${encodeURIComponent(id)}`),

  create: (input: CreateBusinessRuleInput): Promise<BusinessRuleSummary> =>
    apiRequestV1<BusinessRuleSummary>('/business-rules', { method: 'POST', body: input }),

  update: (id: string, patch: UpdateBusinessRuleInput): Promise<BusinessRuleSummary> =>
    apiRequestV1<BusinessRuleSummary>(`/business-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),

  remove: (id: string): Promise<void> =>
    apiRequestV1<never>(`/business-rules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  toggle: (id: string, isEnabled: boolean): Promise<BusinessRuleSummary> =>
    apiRequestV1<BusinessRuleSummary>(`/business-rules/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      body: { isEnabled },
    }),
};
