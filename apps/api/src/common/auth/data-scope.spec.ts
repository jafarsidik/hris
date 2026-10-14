import type { EffectivePermission } from '@hris/shared-types';

import { effectiveScope, resolveScope, canGrant } from './data-scope';

const grant = (
  resource: string,
  action: string,
  scope: EffectivePermission['scope'],
  scopeId?: string,
): EffectivePermission => ({ resource, action, scope, ...(scopeId ? { scopeId } : {}) });

const caller = { userId: 'user-1', unitId: 'unit-1' as string | null };

describe('effectiveScope', () => {
  it('returns null when the caller holds no matching grant', () => {
    expect(effectiveScope([grant('role', 'view', 'GLOBAL')], 'user', 'view')).toBeNull();
  });

  it('treats a manage grant as covering the requested action', () => {
    expect(effectiveScope([grant('user', 'manage', 'COMPANY')], 'user', 'view')).toBe('COMPANY');
  });

  it('keeps the widest scope across multiple grants', () => {
    const permissions = [grant('user', 'view', 'SELF'), grant('user', 'view', 'COMPANY')];
    expect(effectiveScope(permissions, 'user', 'view')).toBe('COMPANY');
  });
});

describe('resolveScope', () => {
  it('grants all records for COMPANY scope', () => {
    expect(resolveScope([grant('user', 'view', 'COMPANY')], 'user', 'view', caller)).toEqual({
      kind: 'all',
    });
  });

  it('grants all records for GLOBAL scope', () => {
    expect(resolveScope([grant('user', 'view', 'GLOBAL')], 'user', 'view', caller)).toEqual({
      kind: 'all',
    });
  });

  it('narrows SELF scope to the caller', () => {
    expect(resolveScope([grant('user', 'view', 'SELF')], 'user', 'view', caller)).toEqual({
      kind: 'self',
      userId: caller.userId,
    });
  });

  it('resolves TEAM and DEPARTMENT to the caller’s unit subtree', () => {
    for (const scope of ['TEAM', 'DEPARTMENT'] as const) {
      expect(resolveScope([grant('user', 'view', scope)], 'user', 'view', caller)).toEqual({
        kind: 'subtree',
        rootUnitId: caller.unitId,
      });
    }
  });

  it('resolves ENTITY to the caller’s unit', () => {
    expect(resolveScope([grant('user', 'view', 'ENTITY')], 'user', 'view', caller)).toEqual({
      kind: 'entity',
      rootUnitId: caller.unitId,
    });
  });

  it('uses an explicit scopeId to anchor an org scope instead of the caller’s unit', () => {
    expect(
      resolveScope([grant('user', 'view', 'DEPARTMENT', 'unit-9')], 'user', 'view', caller),
    ).toEqual({ kind: 'subtree', rootUnitId: 'unit-9' });
  });

  it('default-denies an org scope when the caller has no unit and no scopeId', () => {
    const rootless = { userId: 'user-1', unitId: null };
    expect(resolveScope([grant('user', 'view', 'DEPARTMENT')], 'user', 'view', rootless)).toEqual({
      kind: 'denied',
      scope: 'DEPARTMENT',
    });
  });

  it('default-denies when no grant matches', () => {
    expect(resolveScope([], 'user', 'view', caller)).toEqual({ kind: 'denied', scope: null });
  });
});

describe('canGrant', () => {
  it('rejects a capability the caller does not hold at all', () => {
    expect(
      canGrant([grant('user', 'view', 'COMPANY')], grant('setting', 'manage', 'COMPANY')),
    ).toBe(false);
  });

  it('rejects granting a wider scope than the caller holds', () => {
    expect(canGrant([grant('role', 'manage', 'COMPANY')], grant('role', 'manage', 'GLOBAL'))).toBe(
      false,
    );
  });

  it('allows granting a narrower scope than the caller holds', () => {
    expect(canGrant([grant('role', 'manage', 'GLOBAL')], grant('role', 'manage', 'COMPANY'))).toBe(
      true,
    );
  });

  it('treats manage as covering the granted action', () => {
    expect(canGrant([grant('role', 'manage', 'COMPANY')], grant('role', 'view', 'COMPANY'))).toBe(
      true,
    );
  });

  it('does not let an action-specific grant cover a manage grant', () => {
    expect(canGrant([grant('role', 'view', 'GLOBAL')], grant('role', 'manage', 'COMPANY'))).toBe(
      false,
    );
  });
});
