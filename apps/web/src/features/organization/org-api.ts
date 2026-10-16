import type {
  OrganizationalUnitSummary,
  OrganizationEntitySummary,
  Paginated,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

import type {
  CreateEntityInput,
  CreateUnitInput,
  EntityListFilter,
  OrganizationRepository,
  PageInput,
  UnitListFilter,
  UpdateEntityInput,
  UpdateUnitInput,
} from './org-types';

function pageParams(params: URLSearchParams, page: PageInput): void {
  params.set('limit', String(page.limit ?? 20));
  if (page.cursor) {
    params.set('cursor', page.cursor);
  }
}

/**
 * Organizational structure against the live API.
 *
 * Browser calls carry the `hris_session` cookie, so no bearer token is attached here.
 */
export const apiOrganizationRepository: OrganizationRepository = {
  async listEntities(filter: EntityListFilter, page) {
    const params = new URLSearchParams();
    if (filter.search) params.set('search', filter.search);
    pageParams(params, page);
    return apiRequestV1<Paginated<OrganizationEntitySummary>>(
      `/organization/entities?${params.toString()}`,
    );
  },

  async getEntity(id) {
    return apiRequestV1<OrganizationEntitySummary>(`/organization/entities/${id}`);
  },

  async createEntity(input: CreateEntityInput) {
    return apiRequestV1<OrganizationEntitySummary>('/organization/entities', {
      method: 'POST',
      body: input,
    });
  },

  async updateEntity(id, input: UpdateEntityInput) {
    return apiRequestV1<OrganizationEntitySummary>(`/organization/entities/${id}`, {
      method: 'PATCH',
      body: input,
    });
  },

  async deleteEntity(id) {
    await apiRequestV1<never>(`/organization/entities/${id}`, { method: 'DELETE' });
  },

  async listUnits(filter: UnitListFilter, page) {
    const params = new URLSearchParams();
    if (filter.search) params.set('search', filter.search);
    if (filter.entityId) params.set('entityId', filter.entityId);
    if (filter.parentId) params.set('parentId', filter.parentId);
    if (filter.type) params.set('type', filter.type);
    pageParams(params, page);
    return apiRequestV1<Paginated<OrganizationalUnitSummary>>(
      `/organization/units?${params.toString()}`,
    );
  },

  async getUnit(id) {
    return apiRequestV1<OrganizationalUnitSummary>(`/organization/units/${id}`);
  },

  async createUnit(input: CreateUnitInput) {
    return apiRequestV1<OrganizationalUnitSummary>('/organization/units', {
      method: 'POST',
      body: input,
    });
  },

  async updateUnit(id, input: UpdateUnitInput) {
    return apiRequestV1<OrganizationalUnitSummary>(`/organization/units/${id}`, {
      method: 'PATCH',
      body: input,
    });
  },

  async deleteUnit(id) {
    await apiRequestV1<never>(`/organization/units/${id}`, { method: 'DELETE' });
  },
};
