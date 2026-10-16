import type {
  OrganizationalUnitSummary,
  OrganizationalUnitType,
  OrganizationEntitySummary,
  Paginated,
} from '@hris/shared-types';

export interface PageInput {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface EntityListFilter {
  readonly search?: string;
}

export interface UnitListFilter {
  readonly search?: string;
  readonly entityId?: string;
  readonly parentId?: string;
  readonly type?: OrganizationalUnitType;
}

export interface CreateEntityInput {
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly currencyCode: string;
}

export type UpdateEntityInput = Partial<CreateEntityInput>;

export interface CreateUnitInput {
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationalUnitType;
  readonly entityId?: string | null;
  readonly parentId?: string | null;
}

export interface UpdateUnitInput {
  readonly code?: string;
  readonly name?: string;
  readonly type?: OrganizationalUnitType;
  readonly entityId?: string | null;
  readonly parentId?: string | null;
}

/**
 * Organizational structure administration.
 *
 * Mirrors the API's `/organization` surface. The API narrows every read to the caller's
 * data scope, so the screen renders whatever it is given rather than filtering locally.
 */
export interface OrganizationRepository {
  listEntities(
    filter: EntityListFilter,
    page: PageInput,
  ): Promise<Paginated<OrganizationEntitySummary>>;
  getEntity(id: string): Promise<OrganizationEntitySummary>;
  createEntity(input: CreateEntityInput): Promise<OrganizationEntitySummary>;
  updateEntity(id: string, input: UpdateEntityInput): Promise<OrganizationEntitySummary>;
  deleteEntity(id: string): Promise<void>;

  listUnits(filter: UnitListFilter, page: PageInput): Promise<Paginated<OrganizationalUnitSummary>>;
  getUnit(id: string): Promise<OrganizationalUnitSummary>;
  createUnit(input: CreateUnitInput): Promise<OrganizationalUnitSummary>;
  updateUnit(id: string, input: UpdateUnitInput): Promise<OrganizationalUnitSummary>;
  deleteUnit(id: string): Promise<void>;
}
