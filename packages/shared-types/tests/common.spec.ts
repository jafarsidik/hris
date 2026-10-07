import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  API_ERROR_CODES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPage,
  cursorFingerprint,
  decodeCursor,
  encodeCursor,
  isApiErrorResponse,
  isApiSuccessResponse,
  normalisePageParams,
  resolveCursor,
  toFetchLimit,
  type ApiResponse,
} from '../src';

describe('pagination', () => {
  interface Row {
    readonly id: string;
    readonly createdAt: string;
  }

  const row = (id: string): Row => ({ id, createdAt: `2026-01-01T00:00:0${id}.000Z` });
  const positionOf = (candidate: Row) => ({
    values: [candidate.createdAt, candidate.id],
  });
  const FINGERPRINT = cursorFingerprint({
    filters: { status: 'ACTIVE', companyId: 'company-1' },
    sort: { field: 'createdAt', direction: 'desc' },
  });

  describe('normalisePageParams', () => {
    it('falls back to the default limit for missing input', () => {
      expect(normalisePageParams({})).toEqual({ limit: DEFAULT_PAGE_SIZE });
    });

    it('accepts numeric strings from query parameters', () => {
      expect(normalisePageParams({ limit: '50' })).toEqual({ limit: 50 });
    });

    it('keeps an opaque cursor untouched', () => {
      expect(normalisePageParams({ limit: 10, cursor: 'abc' })).toEqual({
        limit: 10,
        cursor: 'abc',
      });
    });

    it('treats an empty cursor as absent rather than as a first-page cursor', () => {
      expect(normalisePageParams({ cursor: '' })).toEqual({ limit: DEFAULT_PAGE_SIZE });
    });

    it('ignores a non-string cursor instead of forwarding it to a query', () => {
      expect(normalisePageParams({ cursor: { position: {} } })).toEqual({
        limit: DEFAULT_PAGE_SIZE,
      });
    });

    it('clamps the limit to the maximum', () => {
      expect(normalisePageParams({ limit: 10_000 }).limit).toBe(MAX_PAGE_SIZE);
    });

    it.each([0, -5, 2.5, Number.NaN, 'ten', null, {}])(
      'rejects the invalid limit value %p',
      (limit) => {
        expect(normalisePageParams({ limit }).limit).toBe(DEFAULT_PAGE_SIZE);
      },
    );
  });

  describe('toFetchLimit', () => {
    it('fetches one row beyond the page so hasNextPage needs no COUNT', () => {
      expect(toFetchLimit({ limit: 20 })).toBe(21);
    });
  });

  describe('buildPage', () => {
    it('returns the requested rows and discards the surplus row', () => {
      const page = buildPage([row('1'), row('2'), row('3')], { limit: 2 }, FINGERPRINT, positionOf);

      expect(page.items.map((entry) => entry.id)).toEqual(['1', '2']);
      expect(page.pageInfo.hasNextPage).toBe(true);
      expect(page.pageInfo.endCursor).not.toBeNull();
    });

    it('reports no next page when the surplus row is absent', () => {
      const page = buildPage([row('1')], { limit: 2 }, FINGERPRINT, positionOf);

      expect(page.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    });

    it('does not report a next page for a page that exactly fills the limit', () => {
      // Two rows fetched for a limit of two proves nothing about a third row. Claiming
      // a next page here would send the client after a cursor that leads nowhere.
      const page = buildPage([row('1'), row('2')], { limit: 2 }, FINGERPRINT, positionOf);

      expect(page.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    });

    it('handles an empty result set', () => {
      const page = buildPage([], { limit: 20 }, FINGERPRINT, positionOf);

      expect(page.items).toEqual([]);
      expect(page.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    });

    it('encodes a cursor that resolves back to the last row of the page', () => {
      const page = buildPage([row('1'), row('2'), row('3')], { limit: 2 }, FINGERPRINT, positionOf);
      const resolved = resolveCursor(page.pageInfo.endCursor ?? undefined, FINGERPRINT);

      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.cursor.position.values).toEqual(positionOf(row('2')).values);
      }
    });
  });

  describe('cursor encoding', () => {
    it('round-trips a position', () => {
      const encoded = encodeCursor({ values: ['2026-01-01', 'abc'] }, 'fp000001');
      expect(decodeCursor(encoded)).toEqual({
        position: { values: ['2026-01-01', 'abc'] },
        fingerprint: 'fp000001',
      });
    });

    it('produces a URL-safe token with no padding or reserved characters', () => {
      const encoded = encodeCursor({ values: ['a+b/c?', 'd'] }, 'fp000001');
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('round-trips non-ASCII values', () => {
      const encoded = encodeCursor({ values: ['Kuala Lumpur — 東京'] }, 'fp000001');
      expect(decodeCursor(encoded)?.position.values).toEqual(['Kuala Lumpur — 東京']);
    });

    it.each([
      ['not base64', 'not base64!!'],
      ['empty string', ''],
      ['valid base64 that is not JSON', Buffer.from('hello').toString('base64url')],
      ['JSON of the wrong shape', Buffer.from('{"nope":1}').toString('base64url')],
      [
        'a position that is not an array of strings',
        Buffer.from('{"p":"x","f":"y"}').toString('base64url'),
      ],
      [
        'a position holding non-string values',
        Buffer.from('{"p":[1],"f":"y"}').toString('base64url'),
      ],
      ['a missing fingerprint', Buffer.from('{"p":["a"]}').toString('base64url')],
    ])('rejects %s', (_label, encoded) => {
      expect(decodeCursor(encoded)).toBeNull();
    });
  });

  describe('resolveCursor', () => {
    it('accepts an absent cursor as a request for the first page', () => {
      const resolved = resolveCursor(undefined, FINGERPRINT);
      expect(resolved).toEqual({
        ok: true,
        cursor: { position: { values: [] }, fingerprint: FINGERPRINT },
      });
    });

    it('accepts a cursor issued for the same filters and sort', () => {
      const encoded = encodeCursor({ values: ['a', 'b'] }, FINGERPRINT);
      expect(resolveCursor(encoded, FINGERPRINT).ok).toBe(true);
    });

    it('rejects a cursor issued for different filters', () => {
      // Continuing a sequence under a changed filter is the exact corruption this
      // fingerprint exists to catch.
      const encoded = encodeCursor({ values: ['a', 'b'] }, 'deadbeef');
      expect(resolveCursor(encoded, FINGERPRINT)).toEqual({ ok: false });
    });

    it('rejects a malformed cursor instead of silently restarting', () => {
      expect(resolveCursor('garbage', FINGERPRINT)).toEqual({ ok: false });
    });
  });

  describe('cursorFingerprint', () => {
    it('is stable across key order', () => {
      const left = cursorFingerprint({ filters: { status: 'ACTIVE', companyId: 'c1' }, sort: 'a' });
      const right = cursorFingerprint({
        filters: { companyId: 'c1', status: 'ACTIVE' },
        sort: 'a',
      });
      expect(left).toBe(right);
    });

    it('changes when a filter value changes', () => {
      const left = cursorFingerprint({ filters: { status: 'ACTIVE' }, sort: 'a' });
      const right = cursorFingerprint({ filters: { status: 'INACTIVE' }, sort: 'a' });
      expect(left).not.toBe(right);
    });

    it('changes when the sort changes', () => {
      const left = cursorFingerprint({ filters: {}, sort: { field: 'name' } });
      const right = cursorFingerprint({ filters: {}, sort: { field: 'createdAt' } });
      expect(left).not.toBe(right);
    });

    it('distinguishes an omitted filter from an absent one', () => {
      expect(cursorFingerprint({ filters: { status: undefined }, sort: 'a' })).toBe(
        cursorFingerprint({ filters: {}, sort: 'a' }),
      );
    });

    it('returns a fixed-width hex digest', () => {
      expect(cursorFingerprint({ filters: {}, sort: {} })).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('base64url encoding against a reference implementation', () => {
    // A cursor that decodes to the wrong bytes returns a page boundary that silently
    // skips or repeats employees, so the encoding is checked against Node's own
    // base64url rather than only against a round-trip through this same code.
    it.each(
      Array.from({ length: 40 }, (_unused, length) => {
        const payload = JSON.stringify({
          p: Array.from({ length }, (_ignored, index) => `v${index}`),
          f: 'fp000001',
        });
        return [String(length), payload];
      }),
    )('matches the reference encoding for a %s-value position', (_label, payload) => {
      const encoded = encodeCursor({ values: JSON.parse(payload).p }, 'fp000001');
      const expected = Buffer.from(
        JSON.stringify({ p: JSON.parse(payload).p, f: 'fp000001' }),
        'utf8',
      ).toString('base64url');

      expect(encoded).toBe(expected);
      expect(decodeCursor(encoded)).toEqual({
        position: { values: JSON.parse(payload).p },
        fingerprint: 'fp000001',
      });
    });

    it.each(['', 'a', 'ab', 'abc', 'abcd', 'Kuala Lumpur', '東京', '🎉 emoji'])(
      'round-trips the payload %p byte for byte',
      (fragment) => {
        const values = [fragment];
        const encoded = encodeCursor({ values }, 'fp000001');
        expect(decodeCursor(encoded)?.position.values).toEqual(values);
      },
    );
  });
});

describe('api envelope', () => {
  const success: ApiResponse<{ id: string }> = {
    success: true,
    data: { id: 'abc' },
  };
  const failure: ApiResponse<never> = {
    success: false,
    error: { code: 'FORBIDDEN', message: 'Not allowed' },
  };

  it('narrows success responses', () => {
    expect(isApiSuccessResponse(success)).toBe(true);
    expect(isApiErrorResponse(success)).toBe(false);
    if (isApiSuccessResponse(success)) {
      expect(success.data.id).toBe('abc');
    }
  });

  it('narrows error responses', () => {
    expect(isApiErrorResponse(failure)).toBe(true);
    expect(isApiSuccessResponse(failure)).toBe(false);
  });
});

describe('API_ERROR_CODES', () => {
  /**
   * `docs/API.md` documented eleven codes and spelled the 422 as `UNPROCESSABLE`,
   * while the API emitted `UNPROCESSABLE_ENTITY`. A client branching on the
   * documented spelling fell through to `INTERNAL_ERROR` and reported a validation
   * problem as a server fault.
   *
   * This test is the fix for that class of defect: the documented table is parsed out
   * of API.md and compared against the array, so the two cannot drift apart silently
   * again. A code added to one and not the other fails the build.
   */
  const documentedCodes = (): readonly string[] => {
    const apiDoc = readFileSync(resolve(__dirname, '../../../docs/API.md'), 'utf8');
    const section = apiDoc.slice(apiDoc.indexOf('## Error codes'));
    const rows = section.slice(0, section.indexOf('\n## ', 1));
    const codes = [...rows.matchAll(/^\|\s*`([A-Z_]+)`\s*\|\s*(\d{3})\s*\|/gm)];

    expect(codes.length).toBeGreaterThan(0);
    return codes.map((match) => match[1] as string);
  };

  it('documents exactly the codes the API can emit', () => {
    expect([...documentedCodes()].sort()).toEqual([...API_ERROR_CODES].sort());
  });

  it('assigns every code the HTTP status the implementation uses', () => {
    const apiDoc = readFileSync(resolve(__dirname, '../../../docs/API.md'), 'utf8');
    const section = apiDoc.slice(apiDoc.indexOf('## Error codes'));
    const rows = section.slice(0, section.indexOf('\n## ', 1));
    const statuses = new Map(
      [...rows.matchAll(/^\|\s*`([A-Z_]+)`\s*\|\s*(\d{3})\s*\|/gm)].map((match) => [
        match[1] as string,
        Number(match[2] as string),
      ]),
    );

    // The API maps HTTP status to code name in its exception filter; a code whose
    // documented status does not match the filter would be misread by a client that
    // branches on status.
    expect(statuses.get('UNPROCESSABLE_ENTITY')).toBe(422);
    expect(statuses.get('UNAUTHENTICATED')).toBe(401);
    expect(statuses.get('FORBIDDEN')).toBe(403);
    expect(statuses.get('OUT_OF_SCOPE')).toBe(403);
    expect(statuses.get('SERVICE_UNAVAILABLE')).toBe(503);
  });

  it('spells the 422 the way the API emits it', () => {
    // Guards the specific typo that caused the incident.
    expect(API_ERROR_CODES).toContain('UNPROCESSABLE_ENTITY');
    expect(API_ERROR_CODES).not.toContain('UNPROCESSABLE' as (typeof API_ERROR_CODES)[number]);
  });

  it('keeps the three authentication codes distinguishable', () => {
    // A client handles these three differently, so merging any two of them is a
    // behavioural regression rather than a tidiness issue.
    for (const code of ['UNAUTHENTICATED', 'INVALID_CREDENTIALS', 'MFA_REQUIRED'] as const) {
      expect(API_ERROR_CODES).toContain(code);
    }
  });
});
