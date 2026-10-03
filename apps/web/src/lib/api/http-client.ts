import { API_ERROR_CODES, type ApiError, type ApiResponse } from '@hris/shared-types';

/**
 * A failed API call, normalised to the platform error contract.
 *
 * The raw response body and the underlying cause are retained for server-side
 * logging only; `message` and `code` are the only fields safe to render.
 */
export class ApiRequestError extends Error {
  public readonly code: ApiError['code'];
  public readonly status: number;
  public readonly details: ApiError['details'];
  public readonly correlationId: string | undefined;

  constructor(init: {
    code: ApiError['code'];
    message: string;
    status: number;
    details?: ApiError['details'];
    correlationId?: string;
    cause?: unknown;
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiRequestError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.correlationId = init.correlationId;
  }
}

const DEFAULT_CODE = 'INTERNAL_ERROR';
const NETWORK_ERROR_MESSAGE = 'The HRIS service could not be reached. Please try again shortly.';

const isApiErrorCode = (value: unknown): value is ApiError['code'] =>
  typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
  /** Correlates a browser-side failure with the API's server log. */
  readonly correlationId?: string;
}

const parseErrorBody = (body: unknown): Partial<ApiError> => {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return {};
  }
  const error = (body as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const candidate = error as Partial<ApiError>;
  return {
    ...(isApiErrorCode(candidate.code) ? { code: candidate.code } : {}),
    ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
    ...(Array.isArray(candidate.details) ? { details: candidate.details } : {}),
    ...(typeof candidate.correlationId === 'string'
      ? { correlationId: candidate.correlationId }
      : {}),
  };
};

interface RawResult {
  readonly status: number;
  readonly payload: unknown;
  readonly correlationId: string | undefined;
}

/**
 * Performs a request and returns the parsed body without imposing a shape.
 *
 * Shared by {@link apiRequest} and {@link platformApiRequest} so the network and
 * HTTP error handling exists once. Centralising this is what guarantees the web
 * application can never render a raw backend message: whatever the API returned
 * is mapped onto {@link ApiRequestError} with a code the UI can branch on.
 */
async function requestJson(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<RawResult> {
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.correlationId) {
    headers['X-Correlation-Id'] = options.correlationId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause: unknown) {
    throw new ApiRequestError({
      code: 'SERVICE_UNAVAILABLE',
      message: NETWORK_ERROR_MESSAGE,
      status: 0,
      cause,
    });
  }

  const payload: unknown = await response.json().catch(() => undefined);
  const correlationId = response.headers.get('x-correlation-id') ?? undefined;

  if (!response.ok) {
    const parsed = parseErrorBody(payload);
    throw new ApiRequestError({
      code: parsed.code ?? 'INTERNAL_ERROR',
      message: parsed.message ?? 'The request could not be completed',
      status: response.status,
      details: parsed.details,
      correlationId: parsed.correlationId ?? correlationId,
    });
  }

  return { status: response.status, payload, correlationId };
}

/**
 * Calls a versioned business endpoint and unwraps the standard response
 * envelope, returning its `data`.
 */
export async function apiRequest<TData>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<TData> {
  const { status, payload } = await requestJson(baseUrl, path, options);

  if (typeof payload !== 'object' || payload === null || !('success' in payload)) {
    throw new ApiRequestError({
      code: DEFAULT_CODE,
      message: 'The service returned an unexpected response',
      status,
    });
  }

  const envelope = payload as ApiResponse<TData>;
  if (!envelope.success) {
    throw new ApiRequestError({
      code: envelope.error.code,
      message: envelope.error.message,
      status,
      details: envelope.error.details,
      correlationId: envelope.error.correlationId,
    });
  }

  return envelope.data;
}

/**
 * Calls a platform endpoint that opts out of the response envelope and returns
 * the body verbatim.
 *
 * Health probes are marked `@RawResponse()` on the API, so their payload is the
 * bare object. Running one through {@link apiRequest} would reject it for lacking
 * an envelope and report a healthy service as unavailable, which is exactly the
 * kind of failure that erodes trust in a monitoring surface.
 */
export async function platformApiRequest<TData>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<TData> {
  const { status, payload } = await requestJson(baseUrl, path, options);

  if (typeof payload !== 'object' || payload === null) {
    throw new ApiRequestError({
      code: DEFAULT_CODE,
      message: 'The service returned an unexpected response',
      status,
    });
  }

  return payload as TData;
}