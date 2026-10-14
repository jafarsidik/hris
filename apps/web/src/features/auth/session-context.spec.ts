import { describe, expect, it } from 'vitest';

import { can } from './session-context';
import type { EffectivePermission } from '@hris/shared-types';

const permissions: readonly EffectivePermission[] = [
  { resource: 'user', action: 'view', scope: 'COMPANY' },
  { resource: 'user', action: 'create', scope: 'COMPANY' },
  { resource: 'setting', action: 'manage', scope: 'COMPANY' },
];

describe('can', () => {
  it('grants an action the user actually holds', () => {
    expect(can(permissions, 'user.create')).toBe(true);
  });

  it('denies an action the user does not hold', () => {
    expect(can(permissions, 'user.update')).toBe(false);
  });

  it('denies an action on a resource the user never touched', () => {
    expect(can(permissions, 'role.delete')).toBe(false);
  });

  it('is exact on both the resource and the action', () => {
    expect(can(permissions, 'setting.view')).toBe(false);
    expect(can(permissions, 'user.view')).toBe(true);
  });

  it('is empty-safe', () => {
    expect(can([], 'user.view')).toBe(false);
  });
});
