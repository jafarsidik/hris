import type {
  OrganizationalUnitSummary,
  OrganizationEntitySummary,
  Paginated,
} from '@hris/shared-types';

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

/**
 * Offline organizational structure for previews and tests.
 *
 * Serves a fixed, honest sample of the same read models the API returns so the screens
 * can be developed and exercised without the API running. The store is mutable so the
 * management screen's create/update/delete flows work; it resets on reload.
 */
const entityStore: OrganizationEntitySummary[] = [
  {
    id: 'entity-1',
    code: 'HQ',
    name: 'PT Contoh Nusantara',
    countryCode: 'ID',
    currencyCode: 'IDR',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
];

const unitStore: OrganizationalUnitSummary[] = [
  {
    id: 'unit-1',
    entityId: 'entity-1',
    parentId: null,
    type: 'DIVISION',
    code: 'OPS',
    name: 'Operations',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'unit-2',
    entityId: 'entity-1',
    parentId: 'unit-1',
    type: 'DEPARTMENT',
    code: 'ENG',
    name: 'Engineering',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'unit-3',
    entityId: 'entity-1',
    parentId: 'unit-1',
    type: 'DEPARTMENT',
    code: 'FIN',
    name: 'Finance',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'unit-4',
    entityId: 'entity-1',
    parentId: 'unit-2',
    type: 'SECTION',
    code: 'BE',
    name: 'Backend',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
];

const now = (): string => new Date().toISOString();

function emptyPage<T>(items: readonly T[]): Paginated<T> {
  return { items: [...items], pageInfo: { hasNextPage: false, endCursor: null } };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function entityById(id: string): OrganizationEntitySummary {
  const entity = entityStore.find((candidate) => candidate.id === id);
  if (!entity) {
    throw new Error('Entity not found');
  }
  return entity;
}

function unitById(id: string): OrganizationalUnitSummary {
  const unit = unitStore.find((candidate) => candidate.id === id);
  if (!unit) {
    throw new Error('Organizational unit not found');
  }
  return unit;
}

function assertCodeFree(
  rows: readonly { readonly code: string }[],
  code: string,
  kind: string,
): void {
  if (rows.some((row) => row.code.toLowerCase() === code.toLowerCase())) {
    throw new Error(`An ${kind} with code "${code}" already exists.`);
  }
}

export const mockOrganizationRepository: OrganizationRepository = {
  async listEntities(filter: EntityListFilter, page: PageInput) {
    void page;
    const search = filter.search?.toLowerCase();
    const filtered =
      search === undefined
        ? entityStore
        : entityStore.filter(
            (entity) =>
              entity.name.toLowerCase().includes(search) ||
              entity.code.toLowerCase().includes(search),
          );
    return emptyPage(clone(filtered));
  },

  async getEntity(id) {
    return clone(entityById(id));
  },

  async createEntity(input: CreateEntityInput) {
    assertCodeFree(entityStore, input.code, 'entity');
    const entity: OrganizationEntitySummary = {
      id: `entity-${entityStore.length + 1}`,
      code: input.code,
      name: input.name,
      countryCode: input.countryCode,
      currencyCode: input.currencyCode,
      createdAt: now(),
      updatedAt: now(),
    };
    entityStore.push(entity);
    return clone(entity);
  },

  async updateEntity(id, input: UpdateEntityInput) {
    const entity = entityById(id);
    const updated: OrganizationEntitySummary = {
      ...entity,
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      updatedAt: now(),
    };
    const index = entityStore.findIndex((candidate) => candidate.id === id);
    entityStore[index] = updated;
    return clone(updated);
  },

  async deleteEntity(id) {
    if (unitStore.some((unit) => unit.entityId === id)) {
      throw new Error('Remove the entity\u2019s organizational units first.');
    }
    const index = entityStore.findIndex((candidate) => candidate.id === id);
    if (index >= 0) {
      entityStore.splice(index, 1);
    }
  },

  async listUnits(filter: UnitListFilter, page: PageInput) {
    void page;
    const search = filter.search?.toLowerCase();
    const filtered = unitStore.filter((unit) => {
      if (filter.entityId !== undefined && unit.entityId !== filter.entityId) return false;
      if (filter.parentId !== undefined && unit.parentId !== filter.parentId) return false;
      if (filter.type !== undefined && unit.type !== filter.type) return false;
      if (search !== undefined && !unit.name.toLowerCase().includes(search)) return false;
      return true;
    });
    return emptyPage(clone(filtered));
  },

  async getUnit(id) {
    return clone(unitById(id));
  },

  async createUnit(input: CreateUnitInput) {
    assertCodeFree(unitStore, input.code, 'unit');
    const unit: OrganizationalUnitSummary = {
      id: `unit-${unitStore.length + 1}`,
      entityId: input.entityId ?? null,
      parentId: input.parentId ?? null,
      type: input.type,
      code: input.code,
      name: input.name,
      createdAt: now(),
      updatedAt: now(),
    };
    unitStore.push(unit);
    return clone(unit);
  },

  async updateUnit(id, input: UpdateUnitInput) {
    const unit = unitById(id);
    const updated: OrganizationalUnitSummary = {
      ...unit,
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      updatedAt: now(),
    };
    const index = unitStore.findIndex((candidate) => candidate.id === id);
    unitStore[index] = updated;
    return clone(updated);
  },

  async deleteUnit(id) {
    if (unitStore.some((unit) => unit.parentId === id)) {
      throw new Error('Remove the unit\u2019s child units first.');
    }
    const index = unitStore.findIndex((candidate) => candidate.id === id);
    if (index >= 0) {
      unitStore.splice(index, 1);
    }
  },
};
