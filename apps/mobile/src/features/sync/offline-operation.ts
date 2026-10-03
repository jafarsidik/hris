import {
  OFFLINE_OPERATION_TYPES,
  SYNC_STATES,
  type OfflineOperationType,
  type SyncState,
} from '@hris/shared-types';

export { OFFLINE_OPERATION_TYPES, SYNC_STATES };
export type { OfflineOperationType, SyncState };

export interface OfflineOperation {
  /** Client-generated UUID. Reusing one on retry makes the upload idempotent. */
  readonly id: string;
  readonly type: OfflineOperationType;
  /** Stable per-installation identifier, so the server can audit provenance. */
  readonly deviceId: string;
  /** ISO-8601 UTC instant the record was captured on the device. */
  readonly capturedAt: string;
  readonly payload: unknown;
  readonly syncState: SyncState;
  /** Upload attempts made so far; drives exponential backoff. */
  readonly attempts: number;
}

export class InvalidOfflineOperationError extends Error {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`Offline operation field "${field}" ${reason}`);
    this.name = 'InvalidOfflineOperationError';
    this.field = field;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSyncState = (value: unknown): value is SyncState =>
  typeof value === 'string' && (SYNC_STATES as readonly string[]).includes(value);

const isOperationType = (value: unknown): value is OfflineOperationType =>
  typeof value === 'string' && (OFFLINE_OPERATION_TYPES as readonly string[]).includes(value);

/**
 * Validates and narrows an untrusted value into an {@link OfflineOperation}.
 *
 * Rejecting a malformed operation up front matters more than it looks: a record
 * rejected by the server after the device has left the building is invisible to
 * the employee, whereas a local failure is immediate and actionable. The server
 * still re-validates every field, because a client-side check is a usability
 * feature and never a trust boundary.
 */
export function validateOfflineOperation(input: unknown): OfflineOperation {
  if (!isRecord(input)) {
    throw new InvalidOfflineOperationError('operation', 'must be an object');
  }

  const { id, type, deviceId, capturedAt, payload, syncState, attempts } = input;

  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new InvalidOfflineOperationError('id', 'must be a UUID');
  }

  if (!isOperationType(type)) {
    throw new InvalidOfflineOperationError('type', 'must be a supported operation type');
  }

  if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    throw new InvalidOfflineOperationError('deviceId', 'must be a non-empty string');
  }

  if (typeof capturedAt !== 'string' || Number.isNaN(Date.parse(capturedAt))) {
    throw new InvalidOfflineOperationError('capturedAt', 'must be an ISO-8601 timestamp');
  }

  if (payload === undefined) {
    throw new InvalidOfflineOperationError('payload', 'is required');
  }

  if (!isSyncState(syncState)) {
    throw new InvalidOfflineOperationError('syncState', 'must be a known sync state');
  }

  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) {
    throw new InvalidOfflineOperationError('attempts', 'must be a non-negative integer');
  }

  return {
    id,
    type,
    deviceId: deviceId.trim(),
    capturedAt: new Date(capturedAt).toISOString(),
    payload,
    syncState,
    attempts,
  };
}

/** Transitions permitted by the shared sync state machine. */
const ALLOWED_TRANSITIONS: Readonly<Record<SyncState, readonly SyncState[]>> = {
  PENDING: ['SYNCING', 'FAILED', 'CONFLICT'],
  SYNCING: ['SYNCED', 'FAILED', 'CONFLICT'],
  FAILED: ['SYNCING', 'CONFLICT'],
  SYNCED: [],
  CONFLICT: ['PENDING', 'SYNCING'],
};

export const canTransition = (from: SyncState, to: SyncState): boolean =>
  ALLOWED_TRANSITIONS[from].includes(to);

/**
 * Attempts a state transition, returning a new operation.
 *
 * Returning a new value keeps the queue immutable, which is what allows a failed
 * upload to be retried without having partially mutated persisted state.
 */
export function transitionOperation(
  operation: OfflineOperation,
  to: SyncState,
): OfflineOperation {
  if (!canTransition(operation.syncState, to)) {
    throw new InvalidOfflineOperationError(
      'syncState',
      `cannot move from ${operation.syncState} to ${to}`,
    );
  }

  const attempts = to === 'SYNCING' ? operation.attempts + 1 : operation.attempts;

  return { ...operation, syncState: to, attempts };
}

/**
 * Delay before the next upload attempt, capped so a record cannot be stranded.
 *
 * Jitter is derived from the operation id rather than randomness, so a single
 * record does not multiply its own retry cost and tests stay reproducible.
 */
export function backoffDelayMs(operation: OfflineOperation): number {
  const base = Math.min(2 ** operation.attempts * 1_000, 5 * 60_000);
  const jitterWindow = base * 0.2;
  let hash = 0;
  for (const character of operation.id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000;
  }
  return Math.round(base - jitterWindow / 2 + (hash / 1_000) * jitterWindow);
}