import type { ApiError } from '@hris/shared-types';

import { API_PLATFORM_URL, API_TIMEOUT_MS } from './config';

export class MobileApiError extends Error {
  public readonly code: ApiError['code'];
  public readonly status: number;
  public readonly correlationId: string | undefined;

  constructor(init: {
    code: ApiError['code'];
    message: string;
    status: number;
    correlationId?: string;
  }) {
    super(init.message);
    this.name = 'MobileApiError';
    this.code = init.code;
    this.status = init.status;
    this.correlationId = init.correlationId;
  }
}

export interface PlatformLiveness {
  readonly status: 'ok';
  readonly service: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
}

/**
 * Calls an unversioned platform endpoint such as a health probe.
 *
 * Platform endpoints deliberately opt out of the response envelope, so their
 * body is returned verbatim. The mobile client reads employee data exclusively
 * from the API; the only state it owns locally is the explicitly queued offline
 * operations.
 */
export async function fetchPlatformLiveness(signal?: AbortSignal): Promise<PlatformLiveness> {
  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_PLATFORM_URL}/health/live`, {
      headers: { Accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    });
  } catch {
    // The underlying network error is intentionally not surfaced: it carries no
    // useful diagnostic value for an employee and tends to leak host details.
    throw new MobileApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The HRIS service is unreachable. Check your connection and try again.',
      status: 0,
    });
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = (payload as { error?: Partial<ApiError> } | undefined)?.error;
    throw new MobileApiError({
      code: error?.code ?? 'INTERNAL_ERROR',
      message: error?.message ?? 'The request could not be completed.',
      status: response.status,
      correlationId: error?.correlationId ?? undefined,
    });
  }

  if (typeof payload !== 'object' || payload === null || !('status' in payload)) {
    throw new MobileApiError({
      code: 'INTERNAL_ERROR',
      message: 'The service returned an unexpected response.',
      status: response.status,
    });
  }

  return payload as PlatformLiveness;
}