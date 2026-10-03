import {
  DATA_SCOPE_RANK,
  buildPermissionKey,
  isAction,
  isDataScope,
  isPermissionKey,
  isResource,
  parsePermissionKey,
  SYSTEM_ROLES,
} from '../src';

describe('rbac vocabulary', () => {
  describe('parsePermissionKey', () => {
    it('parses a well-formed key', () => {
      expect(parsePermissionKey('employee.view')).toEqual({
        resource: 'employee',
        action: 'view',
      });
    });

    it.each([
      ['', 'empty string'],
      ['employee', 'missing action'],
      ['.view', 'missing resource'],
      ['employee.', 'trailing separator'],
      ['employee.unknown', 'unknown action'],
      ['unknown.view', 'unknown resource'],
      ['payroll.approve.extra', 'extra segment'],
    ])('rejects %j (%s)', (key) => {
      expect(parsePermissionKey(key)).toBeNull();
      expect(isPermissionKey(key)).toBe(false);
    });

    it('round-trips with buildPermissionKey', () => {
      const key = buildPermissionKey('industrial-relation', 'approve');
      expect(parsePermissionKey(key)).toEqual({
        resource: 'industrial-relation',
        action: 'approve',
      });
    });
  });

  describe('type guards', () => {
    it('accepts known values only', () => {
      expect(isResource('payroll')).toBe(true);
      expect(isResource('Payroll')).toBe(false);
      expect(isAction('approve')).toBe(true);
      expect(isAction('APPROVE')).toBe(false);
      expect(isDataScope('ENTITY')).toBe(true);
      expect(isDataScope('entity')).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isResource(42)).toBe(false);
      expect(isAction(null)).toBe(false);
      expect(isDataScope(undefined)).toBe(false);
    });
  });

  describe('DATA_SCOPE_RANK', () => {
    it('orders scopes from narrowest to widest', () => {
      const scopes = Object.entries(DATA_SCOPE_RANK);
      expect(scopes).toHaveLength(6);
      for (let i = 1; i < scopes.length; i += 1) {
        const previous = scopes[i - 1] as [string, number];
        const current = scopes[i] as [string, number];
        expect(previous[1]).toBeLessThan(current[1]);
      }
    });
  });

  describe('SYSTEM_ROLES', () => {
    it('has unique keys and every key marked as a system role', () => {
      const keys = SYSTEM_ROLES.map((role) => role.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(SYSTEM_ROLES.every((role) => role.isSystem)).toBe(true);
    });

    it('is frozen so clients cannot mutate the shared reference', () => {
      expect(Object.isFrozen(SYSTEM_ROLES)).toBe(true);
    });
  });
});
