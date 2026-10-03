import { asEmployeeId, asEntityId, isUuid } from '../src';

describe('branded identifiers', () => {
  const validUuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('accepts a canonical uuid', () => {
    expect(isUuid(validUuid)).toBe(true);
  });

  it.each([
    ['not-a-uuid', 'arbitrary text'],
    ['3f2504e04f8941d39a0c0305e82c3301', 'missing separators'],
    ['3f2504e0-4f89-41d3-9a0c-0305e82c330g', 'non-hex character'],
    ['', 'empty string'],
  ])('rejects %j (%s)', (value) => {
    expect(isUuid(value)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(12345)).toBe(false);
  });

  it('casts a valid uuid to a branded identifier', () => {
    expect(asEmployeeId(validUuid)).toBe(validUuid);
    expect(asEntityId(validUuid)).toBe(validUuid);
  });

  it('throws instead of silently passing a malformed identifier through', () => {
    expect(() => asEmployeeId('nope')).toThrow(TypeError);
    expect(() => asEmployeeId('nope')).toThrow(/Invalid EmployeeId/);
    expect(() => asEntityId(undefined)).toThrow(/Invalid EntityId/);
  });
});