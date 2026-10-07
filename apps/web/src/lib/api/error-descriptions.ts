import { API_ERROR_CODES, type ApiErrorCode } from '@hris/shared-types';
import { ApiRequestError } from '@/lib/api/http-client';

/**
 * Turns an {@link ApiRequestError} into copy the web tier is willing to render.
 *
 * Two rules govern everything here.
 *
 * **The backend's message is never used.** `ApiRequestError.message` is documented as
 * safe to display, but "documented as safe" is a promise about the future, not a
 * guarantee about the response in hand. Every string below is written here instead, so
 * a new backend message can never surface as unvetted user-facing text.
 *
 * **The branch is on `code`, never on `status`.** Two codes can share a status and need
 * different words: `FORBIDDEN` and `OUT_OF_SCOPE` are both 403, but one means the
 * action is not permitted and the other means the record exists and is not yours.
 */

export type ErrorTone = 'error' | 'warning' | 'info';

export interface ApiErrorDescription {
  readonly title: string;
  readonly description: string;
  readonly tone: ErrorTone;
  /** Whether retrying the same request could plausibly succeed. */
  readonly canRetry: boolean;
  /** Whether the reader needs to sign in again to see anything at all. */
  readonly requiresSignIn: boolean;
  /** Safe to show to the user so a support request can be traced to a server log. */
  readonly correlationId?: string;
}

const DESCRIPTIONS: Readonly<Record<ApiErrorCode, Omit<ApiErrorDescription, 'correlationId'>>> = {
  VALIDATION_ERROR: {
    title: 'That request was not valid',
    description:
      'The request could not be processed because some of its values were rejected. Check the values and try again.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  UNAUTHENTICATED: {
    title: 'Your session has ended',
    description: 'Sign in again to continue. Anything unsaved on this page is not kept.',
    tone: 'info',
    canRetry: false,
    requiresSignIn: true,
  },
  INVALID_CREDENTIALS: {
    title: 'Those credentials were not accepted',
    description: 'Check the details you entered and try again.',
    tone: 'warning',
    canRetry: true,
    requiresSignIn: true,
  },
  MFA_REQUIRED: {
    title: 'A second factor is required',
    description: 'Complete the additional verification step to continue.',
    tone: 'info',
    canRetry: false,
    requiresSignIn: true,
  },
  FORBIDDEN: {
    title: 'You do not have permission to do that',
    description:
      'Your role does not include this action. Ask an administrator if you believe it should be available to you.',
    tone: 'error',
    canRetry: false,
    requiresSignIn: false,
  },
  OUT_OF_SCOPE: {
    title: 'That record is outside your data scope',
    description:
      'It exists, but your access does not extend to it. Widening your scope is an administrator action.',
    tone: 'error',
    canRetry: false,
    requiresSignIn: false,
  },
  NOT_FOUND: {
    title: 'Not found',
    description: 'It may have been removed, or the address may be mistyped.',
    tone: 'info',
    canRetry: false,
    requiresSignIn: false,
  },
  CONFLICT: {
    title: 'That conflicts with an existing record',
    description: 'Reload the page to see the current state, then try again.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  PRECONDITION_FAILED: {
    title: 'This action is not available yet',
    description: 'Something has to happen first before this can proceed.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  RATE_LIMITED: {
    title: 'Too many requests',
    description: 'Wait a moment before trying again.',
    tone: 'warning',
    canRetry: true,
    requiresSignIn: false,
  },
  PAYLOAD_TOO_LARGE: {
    title: 'That file is too large',
    description: 'Reduce the size of the upload and try again.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: 'That file type is not accepted',
    description: 'Use one of the accepted formats and try again.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  UNPROCESSABLE_ENTITY: {
    title: 'That action cannot be completed',
    description:
      'The request was understood but cannot be applied to the current state of the record.',
    tone: 'warning',
    canRetry: false,
    requiresSignIn: false,
  },
  INTERNAL_ERROR: {
    title: 'Something went wrong at our end',
    description: 'The problem has been logged. Try again, and quote the reference if it persists.',
    tone: 'error',
    canRetry: true,
    requiresSignIn: false,
  },
  SERVICE_UNAVAILABLE: {
    title: 'The service is unavailable',
    description:
      'A dependency the platform needs is not responding. This is usually temporary and not something you did.',
    tone: 'error',
    canRetry: true,
    requiresSignIn: false,
  },
  NOT_IMPLEMENTED: {
    title: 'Not available in this deployment',
    description: 'This part of the platform has not been built yet.',
    tone: 'info',
    canRetry: false,
    requiresSignIn: false,
  },
};

/** The copy used when the failure was not an {@link ApiRequestError} at all. */
const UNEXPECTED: Omit<ApiErrorDescription, 'correlationId'> = {
  title: 'Something went wrong',
  description: 'An unexpected problem stopped this page from loading. Try again.',
  tone: 'error',
  canRetry: true,
  requiresSignIn: false,
};

export function describeApiError(error: unknown): ApiErrorDescription {
  if (!(error instanceof ApiRequestError)) {
    return UNEXPECTED;
  }

  // A code from a newer API that this build does not know about must not be trusted,
  // and must not be rendered either. `http-client` already falls back to
  // INTERNAL_ERROR, and this lookup fails closed if that fallback ever changes.
  const base = isKnownApiErrorCode(error.code)
    ? DESCRIPTIONS[error.code]
    : DESCRIPTIONS.INTERNAL_ERROR;

  return error.correlationId === undefined ? base : { ...base, correlationId: error.correlationId };
}

const isKnownApiErrorCode = (code: string): code is ApiErrorCode =>
  (API_ERROR_CODES as readonly string[]).includes(code);
