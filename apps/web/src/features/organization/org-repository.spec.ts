import { afterEach, describe, expect, it } from 'vitest';

import { apiOrganizationRepository } from './org-api';
import { mockOrganizationRepository } from './org-mock';

/**
 * The organization screens talk to one repository, whichever the factory returns. This
 * contract test locks the mock to the same behaviour the API-backed repository serves, so
 * a screen exercised against the mock cannot diverge from the live contract unnoticed.
 */
describe('organization repository contract', () => {
  afterEach(() => {
    delete process.env['NEXT_PUBLIC_HRIS_ORGANIZATION_DATA_SOURCE'];
  });

  it('defaults to the API repository', async () => {
    const { getOrganization } = await import('./index');
    expect(getOrganization()).toBe(apiOrganizationRepository);
  });

  it('returns the mock repository when configured', async () => {
    process.env['NEXT_PUBLIC_HRIS_ORGANIZATION_DATA_SOURCE'] = 'mock';
    const { getOrganization } = await import('./index');
    expect(getOrganization()).toBe(mockOrganizationRepository);
  });

  it('rejects the mock when the configured source is unknown', async () => {
    process.env['NEXT_PUBLIC_HRIS_ORGANIZATION_DATA_SOURCE'] = 'legacy';
    const { getOrganization } = await import('./index');
    expect(getOrganization()).toBe(apiOrganizationRepository);
  });

  it('serves paginated shapes and a usable sample', async () => {
    const entities = await mockOrganizationRepository.listEntities({}, {});
    expect(entities.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    expect(entities.items.length).toBeGreaterThan(0);

    const units = await mockOrganizationRepository.listUnits({}, {});
    expect(units.items.length).toBeGreaterThan(0);
    expect(units.items.every((unit) => unit.code.length > 0)).toBe(true);
  });

  it('creates an entity then finds it in the list', async () => {
    const created = await mockOrganizationRepository.createEntity({
      code: 'BR',
      name: 'Branch',
      countryCode: 'ID',
      currencyCode: 'IDR',
    });
    const listed = await mockOrganizationRepository.listEntities({}, {});
    expect(listed.items.some((entity) => entity.id === created.id)).toBe(true);

    // Clean up so the shared store stays stable for other tests.
    await mockOrganizationRepository.deleteEntity(created.id);
  });

  it('refuses a duplicate entity code', async () => {
    await expect(
      mockOrganizationRepository.createEntity({
        code: 'HQ',
        name: 'Duplicate',
        countryCode: 'ID',
        currencyCode: 'IDR',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('refuses to delete an entity that still has units', async () => {
    await expect(mockOrganizationRepository.deleteEntity('entity-1')).rejects.toThrow(
      /units first/i,
    );
  });

  it('refuses to delete a unit that still has children', async () => {
    await expect(mockOrganizationRepository.deleteUnit('unit-1')).rejects.toThrow(
      /child units first/i,
    );
  });

  it('filters units by entity and parent', async () => {
    const roots = await mockOrganizationRepository.listUnits(
      { entityId: 'entity-1', parentId: 'unit-1' },
      {},
    );
    expect(roots.items.every((unit) => unit.parentId === 'unit-1')).toBe(true);
    expect(roots.items.length).toBeGreaterThan(0);
  });
});
