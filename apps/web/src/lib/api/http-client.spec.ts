import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiRequest, platformApiRequest } from './http-client';

const BASE_URL = 'http://api.test/api/v1';

const jsonResponse = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (implementation: (url: string, init?: RequestInit) => Promise<Response>) => {
    const spy = vi.fn(implementation);
    vi.stubGlobal('fetch', spy);
    return spy;
  };

  describe('success', () => {
    it('unwraps the data payload from the envelope', async () => {
      stubFetch(async () => jsonResponse({ success: true, data: { id: 'e-1' } }));

      await expect(apiRequest(BASE_URL, '/employees')).resolves.toEqual({ id: 'e-1' });
    });

    it('joins the base URL and path without doubling slashes', async () => {
      const spy = stubFetch(async () => jsonResponse({ success: true, data: null }));

      await apiRequest(`${BASE_URL}/`, '/employees');
      await apiRequest(BASE_URL, 'employees');

      expect(spy.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/employees');
      expect(spy.mock.calls[1]?.[0]).toBe('http://api.test/api/v1/employees');
    });

    it('sends credentials so cookie-based sessions work', async () => {
      const spy = stubFetch(async () => jsonResponse({ success: true, data: null }));

      await apiRequest(BASE_URL, '/employees');

      expect(spy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    });

    it('serialises a body and sets the JSON content type', async () => {
      const spy = stubFetch(async () => jsonResponse({ success: true, data: null }));

      await apiRequest(BASE_URL, '/claims', { method: 'POST', body: { amount: 100 } });

      const init = spy.mock.calls[0]?.[1] as RequestInit;
      expect(init.body).toBe('{"amount":100}');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('forwards a correlation id for end-to-end tracing', async () => {
      const spy = stubFetch(async () => jsonResponse({ success: true, data: null }));

      await apiRequest(BASE_URL, '/employees', { correlationId: 'web-trace-1' });

      expect((spy.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }).headers[
        'X-Correlation-Id'
      ]).toBe('web-trace-1');
    });
  });

  describe('errors', () => {
    it('maps an API error envelope onto a typed error', async () => {
      stubFetch(async () =>
        jsonResponse(
          {
            success: false,
            error: {
              code: 'OUT_OF_SCOPE',
              message: 'The requested record is outside your permitted data scope',
              correlationId: 'trace-9',
            },
          },
          { status: 403 },
        ),
      );

      const error = await apiRequest(BASE_URL, '/employees/x').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiRequestError);
      const apiError = error as ApiRequestError;
      expect(apiError.code).toBe('OUT_OF_SCOPE');
      expect(apiError.status).toBe(403);
      expect(apiError.correlationId).toBe('trace-9');
    });

    it('falls back to the response header when the body has no correlation id', async () => {
      stubFetch(async () =>
        jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'nope' } }, {
          status: 403,
          headers: { 'x-correlation-id': 'trace-header' },
        }),
      );

      const error = (await apiRequest(BASE_URL, '/x').catch((caught: unknown) => caught)) as ApiRequestError;
      expect(error.correlationId).toBe('trace-header');
    });

    it('rejects an unknown error code rather than trusting it', async () => {
      stubFetch(async () =>
        jsonResponse({ success: false, error: { code: 'DROP_TABLES', message: 'nope' } }, { status: 500 }),
      );

      const error = (await apiRequest(BASE_URL, '/x').catch((caught: unknown) => caught)) as ApiRequestError;
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('reports an unreachable API as unavailable instead of leaking a network error', async () => {
      stubFetch(async () => {
        throw new TypeError('fetch failed');
      });

      const error = (await apiRequest(BASE_URL, '/x').catch((caught: unknown) => caught)) as ApiRequestError;

      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.status).toBe(0);
      expect(error.message).not.toContain('fetch failed');
    });

    it('rejects a 2xx response that is not an API envelope', async () => {
      stubFetch(async () => jsonResponse({ unexpected: true }));

      await expect(apiRequest(BASE_URL, '/x')).rejects.toBeInstanceOf(ApiRequestError);
    });

    it('rejects a non-JSON error body without leaking its contents', async () => {
      stubFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));

      const error = (await apiRequest(BASE_URL, '/x').catch((caught: unknown) => caught)) as ApiRequestError;

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.status).toBe(502);
      expect(error.message).not.toContain('Bad Gateway');
    });

    it('treats an error envelope returned with a 200 as a failure', async () => {
      stubFetch(async () =>
        jsonResponse({ success: false, error: { code: 'CONFLICT', message: 'duplicate' } }),
      );

      const error = (await apiRequest(BASE_URL, '/x').catch((caught: unknown) => caught)) as ApiRequestError;
      expect(error.code).toBe('CONFLICT');
    });
  });
});
describe('platformApiRequest', () => {
  const PLATFORM_URL = 'http://api.test';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (implementation: (url: string, init?: RequestInit) => Promise<Response>) => {
    const spy = vi.fn(implementation);
    vi.stubGlobal('fetch', spy);
    return spy;
  };

  // Regression guard: health probes are @RawResponse() on the API and return a
  // bare object. Sending one through the envelope-expecting apiRequest made a
  // perfectly healthy service render as "Unavailable".
  it('returns a bare payload that carries no response envelope', async () => {
    const body = { status: 'ok', service: 'hris-api', environment: 'production', uptimeSeconds: 12 };
    stubFetch(async () => jsonResponse(body));

    await expect(platformApiRequest(PLATFORM_URL, '/health/live')).resolves.toEqual(body);
  });

  it('does not mistake a bare payload for an error envelope', async () => {
    stubFetch(async () => jsonResponse({ status: 'ok', info: {}, error: {} }));

    const result = await platformApiRequest<{ status: string }>(PLATFORM_URL, '/health/ready');
    expect(result.status).toBe('ok');
  });

  it('still maps an error envelope onto a typed error', async () => {
    stubFetch(async () =>
      jsonResponse(
        { success: false, error: { code: 'FORBIDDEN', message: 'nope', correlationId: 't-1' } },
        { status: 403 },
      ),
    );

    const error = (await platformApiRequest(PLATFORM_URL, '/x').catch(
      (caught: unknown) => caught,
    )) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.correlationId).toBe('t-1');
  });

  it('reports an unreachable service as unavailable', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(platformApiRequest(PLATFORM_URL, '/health/live')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 0,
    });
  });

  it('rejects a non-object body rather than returning it as data', async () => {
    stubFetch(async () => jsonResponse('ok'));

    await expect(platformApiRequest(PLATFORM_URL, '/health/live')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
