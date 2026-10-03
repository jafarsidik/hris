import { describe, expect, it } from 'vitest';

import {
  InvalidOfflineOperationError,
  backoffDelayMs,
  canTransition,
  transitionOperation,
  validateOfflineOperation,
  type OfflineOperation,
} from './offline-operation';

const validInput = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  type: 'ATTENDANCE_CHECK_IN',
  deviceId: 'device-abc-123',
  capturedAt: '2026-01-15T08:59:00.000Z',
  payload: { method: 'GEOFENCE', latitude: 3.139, longitude: 101.6869 },
  syncState: 'PENDING',
  attempts: 0,
};

// Overrides are `Record<string, unknown>` on purpose: the validator accepts untrusted
// input, so the tests must be able to pass values that are not valid operations.
const operation = (overrides: Record<string, unknown> = {}): OfflineOperation =>
  validateOfflineOperation({ ...validInput, ...overrides });

describe('validateOfflineOperation', () => {
  it('accepts a well-formed operation', () => {
    expect(validateOfflineOperation(validInput)).toMatchObject({
      id: validInput.id,
      type: 'ATTENDANCE_CHECK_IN',
      syncState: 'PENDING',
      attempts: 0,
    });
  });

  it('normalises the capture timestamp to UTC', () => {
    const result = operation({ capturedAt: '2026-01-15T16:59:00+08:00' });
    expect(result.capturedAt).toBe('2026-01-15T08:59:00.000Z');
  });

  it('trims the device identifier', () => {
    expect(operation({ deviceId: '  device-abc-123  ' }).deviceId).toBe('device-abc-123');
  });

  it.each([
    [null, 'operation'],
    ['string', 'operation'],
    [[], 'operation'],
  ])('rejects the non-object input %p', (input, field) => {
    expect(() => validateOfflineOperation(input)).toThrow(InvalidOfflineOperationError);
    try {
      validateOfflineOperation(input);
    } catch (error) {
      expect((error as InvalidOfflineOperationError).field).toBe(field);
    }
  });

  it.each([
    ['not-a-uuid', 'id'],
    [12345, 'id'],
    ['', 'id'],
  ])('rejects the invalid id %p', (id, field) => {
    expect.assertions(2);
    try {
      operation({ id });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidOfflineOperationError);
      expect((error as InvalidOfflineOperationError).field).toBe(field);
    }
  });

  it('rejects an operation type outside the shared allowlist', () => {
    expect(() => operation({ type: 'PAYROLL_DISBURSE' })).toThrow(/type/);
  });

  it('accepts every operation type defined in the shared contract', () => {
    for (const type of [
      'ATTENDANCE_CHECK_IN',
      'ATTENDANCE_CHECK_OUT',
      'ATTENDANCE_CORRECTION_REQUEST',
      'LEAVE_REQUEST',
      'LEAVE_CANCELLATION',
      'CLAIM_SUBMISSION',
      'APPROVAL_DECISION',
    ] as const) {
      expect(operation({ type }).type).toBe(type);
    }
  });

  it.each([[''], ['   '], [null], [42]])('rejects the invalid deviceId %p', (deviceId) => {
    expect(() => operation({ deviceId })).toThrow(/deviceId/);
  });

  it.each([['yesterday'], ['2026-13-45T99:99:99Z'], [1737000000000]])(
    'rejects the invalid capturedAt %p',
    (capturedAt) => {
      expect(() => operation({ capturedAt })).toThrow(/capturedAt/);
    },
  );

  it('rejects a missing payload', () => {
    expect(() => validateOfflineOperation({ ...validInput, payload: undefined })).toThrow(
      /payload/,
    );
  });

  it('rejects an unknown sync state', () => {
    expect(() => operation({ syncState: 'MOSTLY_DONE' })).toThrow(/syncState/);
  });

  it.each([[-1], [1.5], [Number.NaN], ['3']])('rejects the invalid attempts %p', (attempts) => {
    expect(() => operation({ attempts })).toThrow(/attempts/);
  });

  it('does not mutate the input object', () => {
    const input = { ...validInput };
    validateOfflineOperation(input);
    expect(input).toEqual(validInput);
  });
});

describe('canTransition', () => {
  it.each([
    ['PENDING', 'SYNCING', true],
    ['PENDING', 'FAILED', true],
    ['PENDING', 'CONFLICT', true],
    ['SYNCING', 'SYNCED', true],
    ['SYNCING', 'FAILED', true],
    ['FAILED', 'SYNCING', true],
    ['CONFLICT', 'PENDING', true],
    ['SYNCED', 'SYNCING', false],
    ['SYNCED', 'SYNCING', false],
    ['PENDING', 'SYNCED', false],
    ['SYNCING', 'PENDING', false],
  ] as const)('allows %s -> %s to be %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });

  it('treats SYNCED as terminal', () => {
    expect(canTransition('SYNCED', 'PENDING')).toBe(false);
    expect(canTransition('SYNCED', 'FAILED')).toBe(false);
  });
});

describe('transitionOperation', () => {
  it('increments attempts when an upload begins', () => {
    const result = transitionOperation(operation({ attempts: 2 }), 'SYNCING');
    expect(result).toMatchObject({ syncState: 'SYNCING', attempts: 3 });
  });

  it('does not increment attempts for a terminal transition', () => {
    const result = transitionOperation(operation({ attempts: 2, syncState: 'SYNCING' }), 'SYNCED');
    expect(result).toMatchObject({ syncState: 'SYNCED', attempts: 2 });
  });

  it('returns a new object rather than mutating', () => {
    const original = operation();
    const result = transitionOperation(original, 'SYNCING');
    expect(result).not.toBe(original);
    expect(original.syncState).toBe('PENDING');
  });

  it('refuses an illegal transition', () => {
    expect(() => transitionOperation(operation(), 'SYNCED')).toThrow(InvalidOfflineOperationError);
  });

  it('refuses to replay an already synced operation', () => {
    expect(() => transitionOperation(operation({ syncState: 'SYNCED' }), 'SYNCING')).toThrow();
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially with attempts', () => {
    const first = backoffDelayMs(operation({ attempts: 0 }));
    const second = backoffDelayMs(operation({ attempts: 1 }));
    const third = backoffDelayMs(operation({ attempts: 2 }));
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('caps the delay so a record is eventually retried', () => {
    expect(backoffDelayMs(operation({ attempts: 50 }))).toBeLessThanOrEqual(5 * 60_000);
  });

  it('is deterministic for the same operation', () => {
    expect(backoffDelayMs(operation({ attempts: 3 }))).toBe(
      backoffDelayMs(operation({ attempts: 3 })),
    );
  });

  it('applies jitter within twenty percent of the base delay', () => {
    const base = 2 ** 3 * 1_000;
    for (const id of [
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      '9c858901-8a57-4791-81fe-4c455b099bc9',
      'b6d51b7c-e6f5-4a2f-9a1e-0f0d3a5c8f11',
    ]) {
      const delay = backoffDelayMs(operation({ id, attempts: 3 }));
      expect(delay).toBeGreaterThanOrEqual(base * 0.9);
      expect(delay).toBeLessThanOrEqual(base * 1.1);
    }
  });
});
