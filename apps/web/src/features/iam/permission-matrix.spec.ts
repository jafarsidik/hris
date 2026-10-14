import type { RegisteredActionSummary, ResourceSummary } from '@hris/shared-types';

import {
  DEFAULT_SCOPE,
  grantsToMap,
  grantKey,
  groupMatrixByModule,
  hasGrant,
  mapToGrants,
  scopeFor,
  setGrantScope,
  toMatrixResources,
  toggleGrant,
} from './permission-matrix';

function action(
  actionKey: string,
  overrides: Partial<RegisteredActionSummary> = {},
): RegisteredActionSummary {
  return {
    id: `action-${actionKey}`,
    action: actionKey,
    name: actionKey,
    description: null,
    isCustom: false,
    ...overrides,
  };
}

function resource(
  key: string,
  actions: readonly RegisteredActionSummary[],
  overrides: Partial<ResourceSummary> = {},
): ResourceSummary {
  return {
    id: `resource-${key}`,
    applicationId: 'app-1',
    moduleId: null,
    moduleKey: null,
    key,
    name: key,
    description: null,
    resourceType: 'ENTITY',
    supportsCrud: false,
    isActive: true,
    fields: [],
    actions,
    ...overrides,
  };
}

describe('toMatrixResources', () => {
  it('sorts resources by key and orders actions by the shared vocabulary', () => {
    const matrix = toMatrixResources([
      resource('user', [action('update'), action('view'), action('create')]),
      resource('role', [action('delete'), action('view')]),
    ]);

    expect(matrix.map((row) => row.key)).toEqual(['role', 'user']);
    expect(matrix[1]?.actions.map((cell) => cell.action)).toEqual(['view', 'create', 'update']);
    expect(matrix[1]?.actions[0]?.grantKey).toBe(grantKey('user', 'view'));
  });

  it('carries the module and support flags through', () => {
    const matrix = toMatrixResources([
      resource('employee', [action('view')], { moduleKey: 'M01_CORE_HR', supportsCrud: true }),
    ]);

    expect(matrix[0]).toMatchObject({ moduleKey: 'M01_CORE_HR', supportsCrud: true });
  });
});

describe('groupMatrixByModule', () => {
  it('orders groups by the module list and keeps unassigned resources last', () => {
    const matrix = toMatrixResources([
      resource('setting', [action('view')], { moduleKey: 'M00_AUTHENTICATION' }),
      resource('orphan', [action('view')]),
      resource('employee', [action('view')], { moduleKey: 'M07_ADMINISTRATION' }),
    ]);

    const groups = groupMatrixByModule(matrix, [
      { key: 'M07_ADMINISTRATION', name: 'Administration' },
      { key: 'M00_AUTHENTICATION', name: 'System' },
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'M07_ADMINISTRATION',
      'M00_AUTHENTICATION',
      null,
    ]);
    expect(groups[0]?.name).toBe('Administration');
    expect(groups[2]?.name).toBe('Unassigned');
  });

  it('exposes the union of a group actions as ordered column headers', () => {
    const matrix = toMatrixResources([
      resource('user', [action('view'), action('update')], { moduleKey: 'M00_AUTHENTICATION' }),
      resource('role', [action('view'), action('create')], { moduleKey: 'M00_AUTHENTICATION' }),
    ]);

    const groups = groupMatrixByModule(matrix, [{ key: 'M00_AUTHENTICATION', name: 'System' }]);

    expect(groups[0]?.columns).toEqual(['view', 'create', 'update']);
  });
});

describe('selection helpers', () => {
  it('toggles a cell on with the default scope and off again', () => {
    const off = toggleGrant(new Map(), 'user', 'view');
    expect(hasGrant(off, 'user', 'view')).toBe(true);
    expect(scopeFor(off, 'user', 'view')).toBe(DEFAULT_SCOPE);

    const back = toggleGrant(off, 'user', 'view');
    expect(hasGrant(back, 'user', 'view')).toBe(false);
  });

  it('re-scopes an enabled cell and ignores a disabled one', () => {
    const on = toggleGrant(new Map(), 'user', 'view');
    const scoped = setGrantScope(on, 'user', 'view', 'SELF');
    expect(scopeFor(scoped, 'user', 'view')).toBe('SELF');

    const untouched = setGrantScope(scoped, 'user', 'delete', 'SELF');
    expect(hasGrant(untouched, 'user', 'delete')).toBe(false);
  });

  it('indexes grants last-write-wins and serialises in a stable order', () => {
    const map = grantsToMap([
      { resource: 'user', action: 'view', scope: 'COMPANY' },
      { resource: 'user', action: 'view', scope: 'SELF' },
      { resource: 'role', action: 'create', scope: 'COMPANY' },
    ]);

    expect(scopeFor(map, 'user', 'view')).toBe('SELF');
    expect(mapToGrants(map)).toEqual([
      { resource: 'role', action: 'create', scope: 'COMPANY' },
      { resource: 'user', action: 'view', scope: 'SELF' },
    ]);
  });
});
