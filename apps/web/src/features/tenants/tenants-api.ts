import type { TenantSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const tenantsApi = {
  list: (): Promise<readonly TenantSummary[]> => apiRequestV1('/tenants'),
  get: (id: string) => apiRequestV1<TenantSummary>(`/tenants/${encodeURIComponent(id)}`),
  update: (
    id: string,
    patch: {
      status?: string;
      plan?: string;
      seatLimit?: number | null;
      storageQuotaBytes?: number | null;
      suspend?: boolean;
    },
  ) =>
    apiRequestV1<TenantSummary>(`/tenants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  suspend: (id: string) =>
    apiRequestV1<never>(`/tenants/${encodeURIComponent(id)}/suspend`, { method: 'PATCH' }),
  activate: (id: string) =>
    apiRequestV1<never>(`/tenants/${encodeURIComponent(id)}/activate`, { method: 'PATCH' }),
};
