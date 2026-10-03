import { resolveCorrelationId } from './correlation-id.middleware';

describe('resolveCorrelationId', () => {
  it('keeps a well-formed inbound id so a trace survives across services', () => {
    expect(resolveCorrelationId('req_01HZX-9abc_DEF')).toBe('req_01HZX-9abc_DEF');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveCorrelationId('  abc123  ')).toBe('abc123');
  });

  it.each([
    ['an empty string', ''],
    ['only whitespace', '   '],
    ['a non-string', 42],
    ['an object', { id: 'abc' }],
    ['characters that could forge a log line', 'abc\nINFO forged entry'],
    ['header-injection characters', 'abc\r\nSet-Cookie: a=b'],
    ['spaces', 'abc def'],
    ['a value longer than the accepted limit', 'a'.repeat(65)],
  ])('replaces %s with a generated id', (_description, inbound) => {
    const resolved = resolveCorrelationId(inbound);
    expect(resolved).not.toBe(inbound);
    expect(resolved).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a value at exactly the length limit', () => {
    const atLimit = 'a'.repeat(64);
    expect(resolveCorrelationId(atLimit)).toBe(atLimit);
  });

  it('generates a distinct id on every call', () => {
    const generated = [
      resolveCorrelationId(undefined),
      resolveCorrelationId(undefined),
      resolveCorrelationId('invalid input'),
    ];

    expect(new Set(generated).size).toBe(generated.length);
    for (const value of generated) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
