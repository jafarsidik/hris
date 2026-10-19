import type { ServiceAccountSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const serviceAccountsApi = {
  list: (): Promise<readonly ServiceAccountSummary[]> => apiRequestV1('/service-accounts'),
  create: (input: {
    readonly name: string;
    readonly description?: string | null;
    readonly key: string;
    readonly expiresAt?: string;
  }) =>
    apiRequestV1<{ readonly summary: ServiceAccountSummary; readonly secret: string }>(
      '/service-accounts',
      {
        method: 'POST',
        body: input,
      },
    ),
  rotateSecret: (id: string) =>
    apiRequestV1<{ readonly secret: string }>(
      `/service-accounts/${encodeURIComponent(id)}/rotate-secret`,
      {
        method: 'POST',
      },
    ),
  update: (
    id: string,
    patch: {
      readonly name?: string;
      readonly description?: string | null;
      readonly isActive?: boolean;
      readonly expiresAt?: string;
    },
  ) =>
    apiRequestV1<ServiceAccountSummary>(`/service-accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/service-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
