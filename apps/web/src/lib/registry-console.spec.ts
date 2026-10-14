import type { EffectivePermission, ResourceSummary } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import { consoleFor } from './console';
import { registryConsoleItems } from './registry-console';

const PERMISSION = (resource: string, action: string): EffectivePermission =>
  ({ resource, action }) as EffectivePermission;

function makeResource(overrides: Partial<ResourceSummary> & { key: string }): ResourceSummary {
  return {
    id: `id-${overrides.key}`,
    applicationId: 'app-1',
    moduleId: null,
    moduleKey: null,
    name: overrides.key,
    description: null,
    resourceType: 'ENTITY',
    supportsCrud: true,
    isActive: true,
    fields: [],
    actions: [],
    ...overrides,
  } as ResourceSummary;
}

describe('registryConsoleItems', () => {
  it('derives an item for a CRUD resource the caller may view', () => {
    const items = registryConsoleItems(
      [makeResource({ key: 'asset' })],
      [PERMISSION('asset', 'view')],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('asset');
    expect(items[0]?.href).toBe('/setup/registry?resource=asset');
    expect(items[0]?.permission).toBe('asset.view');
    expect(items[0]?.status).toBe('built');
  });

  it('hides a resource the caller cannot view', () => {
    expect(registryConsoleItems([makeResource({ key: 'asset' })], [])).toHaveLength(0);
    expect(
      registryConsoleItems([makeResource({ key: 'asset' })], [PERMISSION('asset', 'create')]),
    ).toHaveLength(0);
  });

  it('ignores inactive and non-CRUD resources', () => {
    const items = registryConsoleItems(
      [
        makeResource({ key: 'hidden', isActive: false }),
        makeResource({ key: 'reference', supportsCrud: false }),
        makeResource({ key: 'visible' }),
      ],
      [
        PERMISSION('hidden', 'view'),
        PERMISSION('reference', 'view'),
        PERMISSION('visible', 'view'),
      ],
    );

    expect(items.map((item) => item.label)).toEqual(['visible']);
  });

  it('url-encodes the resource key in the link', () => {
    const items = registryConsoleItems(
      [makeResource({ key: 'time.off' })],
      [PERMISSION('time.off', 'view')],
    );

    expect(items[0]?.href).toBe('/setup/registry?resource=time.off');
  });
});

describe('consoleFor with registry items', () => {
  it('merges derived items into the metadata section', () => {
    const sections = consoleFor(
      [PERMISSION('registry', 'view'), PERMISSION('asset', 'view')],
      registryConsoleItems(
        [makeResource({ key: 'asset', name: 'Assets' })],
        [PERMISSION('asset', 'view')],
      ),
    );

    const metadata = sections.find((section) => section.id === 'metadata');
    expect(metadata?.items.map((item) => item.label)).toContain('Assets');
    expect(sections).toHaveLength(10);
  });

  it('drops a derived item when the caller loses the permission', () => {
    const registryItems = registryConsoleItems(
      [makeResource({ key: 'asset', name: 'Assets' })],
      [PERMISSION('asset', 'view')],
    );

    const sections = consoleFor([PERMISSION('registry', 'view')], registryItems);
    const metadata = sections.find((section) => section.id === 'metadata');

    expect(metadata?.items.map((item) => item.label)).not.toContain('Assets');
    expect(metadata?.isEmpty).toBe(false);
  });
});
