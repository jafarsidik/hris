import type { Paginated } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

import type {
  ApiRequestListFilter,
  ApiRequestLogEntry,
  ApiUsageFilter,
  ApiUsageReport,
  CreateApiClientInput,
  DeveloperApiClient,
  DeveloperApiClientWithSecret,
  DeveloperRepository,
  UpdateApiClientInput,
} from './developer-types';

/** Serialises the shared window/client filter onto a query string. */
function usageParams(filter: ApiUsageFilter): string {
  const params = new URLSearchParams();
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.clientId) params.set('clientId', filter.clientId);
  return params.toString();
}

/**
 * Developer API clients against the live API.
 *
 * Browser calls carry the `hris_session` cookie, so no bearer token is attached here.
 * The secret is present only in the create and rotate responses; it is never returned
 * by a read.
 */
export const apiDeveloperRepository: DeveloperRepository = {
  async listClients() {
    return apiRequestV1<readonly DeveloperApiClient[]>('/developers/clients');
  },

  async getClient(id) {
    return apiRequestV1<DeveloperApiClient>(`/developers/clients/${id}`);
  },

  async createClient(input: CreateApiClientInput) {
    return apiRequestV1<DeveloperApiClientWithSecret>('/developers/clients', {
      method: 'POST',
      body: input,
    });
  },

  async updateClient(id, input: UpdateApiClientInput) {
    return apiRequestV1<DeveloperApiClient>(`/developers/clients/${id}`, {
      method: 'PATCH',
      body: input,
    });
  },

  async rotateClient(id) {
    return apiRequestV1<DeveloperApiClientWithSecret>(`/developers/clients/${id}/rotate`, {
      method: 'POST',
    });
  },

  async deleteClient(id) {
    await apiRequestV1<never>(`/developers/clients/${id}`, { method: 'DELETE' });
  },

  async getUsage(filter: ApiUsageFilter) {
    const query = usageParams(filter);
    return apiRequestV1<ApiUsageReport>(`/developers/usage${query === '' ? '' : `?${query}`}`);
  },

  async listRequests(filter: ApiRequestListFilter) {
    const params = new URLSearchParams(usageParams(filter));
    params.set('limit', String(filter.limit ?? 20));
    if (filter.cursor) {
      params.set('cursor', filter.cursor);
    }
    return apiRequestV1<Paginated<ApiRequestLogEntry>>(`/developers/requests?${params.toString()}`);
  },
};
