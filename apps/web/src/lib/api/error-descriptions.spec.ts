import { API_ERROR_CODES } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import { ApiRequestError } from './http-client';

import { describeApiError } from './error-descriptions';

const errorWith = (code: string, correlationId?: string, status = 500) =>
  new ApiRequestError({
    // Deliberately constructed through the class rather than a typed literal: this test
    // exists to prove the mapping fails closed for a code from a newer API, which
    // TypeScript would otherwise forbid me from writing.
    code: code as ConstructorParameters<typeof ApiRequestError>[0]['code'],
    message: 'backend message that must never be rendered',
    status,
    ...(correlationId === undefined ? {} : { correlationId }),
  });

describe('describeApiError', () => {
  it('maps every code in the platform contract', () => {
    for (const code of API_ERROR_CODES) {
      const described = describeApiError(errorWith(code));

      expect(described.title, `missing title for ${code}`).not.toBe('');
      expect(described.description, `missing description for ${code}`).not.toBe('');
      expect(['error', 'warning', 'info'], `bad tone for ${code}`).toContain(described.tone);
    }
  });

  it('never surfaces the backend message', () => {
    for (const code of API_ERROR_CODES) {
      const described = describeApiError(errorWith(code));

      expect(described.title).not.toContain('backend message');
      expect(described.description).not.toContain('backend message');
    }
  });

  it('gives the same code the same copy every time', () => {
    for (const code of API_ERROR_CODES) {
      expect(describeApiError(errorWith(code))).toEqual(describeApiError(errorWith(code)));
    }
  });

  it('distinguishes the two codes that share status 403', () => {
    const forbidden = errorWith('FORBIDDEN', undefined, 403);
    const outOfScope = errorWith('OUT_OF_SCOPE', undefined, 403);

    // Both are 403 and neither is retryable, so if the mapping branched on status the
    // two would collapse into the same words. "You may not do this" and "this exists
    // but is not yours" need different answers.
    expect(describeApiError(forbidden).title).not.toBe(describeApiError(outOfScope).title);
    expect(describeApiError(forbidden).description).not.toBe(
      describeApiError(outOfScope).description,
    );
  });

  it('branches on code even when statuses differ from the real ones', () => {
    const notFound = errorWith('NOT_FOUND', undefined, 503);

    // A mislabelled status must not change the wording, or the copy would describe a
    // different problem from the one the code names.
    expect(describeApiError(notFound).title).toBe(describeApiError(errorWith('NOT_FOUND')).title);
  });

  it('treats a code it does not recognise as an internal error', () => {
    const described = describeApiError(errorWith('TEAPOT_UPGRADED'));

    expect(described.title).toBe(describeApiError(errorWith('INTERNAL_ERROR')).title);
    expect(described.canRetry).toBe(true);
  });

  it.each([
    ['a string', 'boom'],
    ['a plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a number', 500],
    ['an object', { code: 'NOT_FOUND' }],
  ])('falls back to generic copy for %s', (_label, thrown) => {
    const described = describeApiError(thrown);

    expect(described.title).toBe('Something went wrong');
    expect(described.canRetry).toBe(true);
    expect(described.requiresSignIn).toBe(false);
  });

  it('includes the correlation id when the error carries one', () => {
    expect(describeApiError(errorWith('INTERNAL_ERROR', 'req-abc-123')).correlationId).toBe(
      'req-abc-123',
    );
  });

  it('omits the correlation id when there is none', () => {
    expect(describeApiError(errorWith('INTERNAL_ERROR')).correlationId).toBeUndefined();
  });

  it('marks session codes as needing a sign-in', () => {
    for (const code of ['UNAUTHENTICATED', 'INVALID_CREDENTIALS', 'MFA_REQUIRED']) {
      expect(describeApiError(errorWith(code)).requiresSignIn, code).toBe(true);
    }
  });

  it('does not mark other codes as needing a sign-in', () => {
    for (const code of API_ERROR_CODES.filter(
      (candidate) =>
        !['UNAUTHENTICATED', 'INVALID_CREDENTIALS', 'MFA_REQUIRED'].includes(candidate),
    )) {
      expect(describeApiError(errorWith(code)).requiresSignIn, code).toBe(false);
    }
  });

  it('offers a retry only where retrying could plausibly help', () => {
    const retryable = API_ERROR_CODES.filter((code) => describeApiError(errorWith(code)).canRetry);

    // Back-pressure and outages are worth another attempt; a rejected input or a denied
    // permission is not, and offering "try again" there trains people to click it blindly.
    expect([...retryable].sort()).toEqual([
      'INTERNAL_ERROR',
      'INVALID_CREDENTIALS',
      'RATE_LIMITED',
      'SERVICE_UNAVAILABLE',
    ]);
  });

  it('warns rather than alarms for back-pressure', () => {
    expect(describeApiError(errorWith('RATE_LIMITED')).tone).toBe('warning');
    expect(describeApiError(errorWith('SERVICE_UNAVAILABLE')).tone).toBe('error');
  });

  it.each(['NOT_FOUND', 'NOT_IMPLEMENTED', 'MFA_REQUIRED'])(
    'treats %s as information rather than a fault',
    (code) => {
      expect(describeApiError(errorWith(code)).tone).toBe('info');
    },
  );
});
