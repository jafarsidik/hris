import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { lastValueFrom, of, throwError } from 'rxjs';

import { AccessLogInterceptor } from './access-log.interceptor';

const createContext = (request: Request, statusCode = 200): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }) as Response,
    }),
  }) as unknown as ExecutionContext;

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'GET',
    path: '/api/v1/employees',
    ip: '10.1.2.3',
    headers: { 'user-agent': 'jest' },
    correlationId: 'trace-1',
    ...overrides,
  }) as Request;

describe('AccessLogInterceptor', () => {
  let interceptor: AccessLogInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new AccessLogInterceptor();
    logSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(interceptor['logger'], 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(interceptor['logger'], 'error').mockImplementation(() => undefined);
  });

  const run = async (request: Request, statusCode: number, error?: Error): Promise<void> => {
    const next: CallHandler = {
      handle: () => (error ? throwError(() => error) : of({ ok: true })),
    };
    await lastValueFrom(interceptor.intercept(createContext(request, statusCode), next)).catch(
      () => undefined,
    );
  };

  it('logs a successful request at info level', async () => {
    await run(createRequest(), 200);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/employees',
        statusCode: 200,
        correlationId: 'trace-1',
        ip: '10.1.2.3',
      }),
      'HTTP',
    );
  });

  it.each([
    [400, 'warn'],
    [401, 'warn'],
    [403, 'warn'],
    [404, 'warn'],
    [500, 'error'],
    [503, 'error'],
  ] as const)('escalates status %i to the %s level', async (statusCode, level) => {
    await run(createRequest(), statusCode);

    const spy = level === 'error' ? errorSpy : warnSpy;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('still logs when the handler fails', async () => {
    await run(createRequest(), 500, new Error('boom'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('never records the query string, which can embed personal data', async () => {
    await run(
      createRequest({
        path: '/api/v1/employees',
        query: { ssn: '900101-14-5533' },
      } as Partial<Request>),
      200,
    );

    const logged = JSON.stringify(logSpy.mock.calls[0]?.[0]);
    expect(logged).not.toContain('900101-14-5533');
    expect(logged).not.toContain('ssn');
  });

  it('records a numeric duration', async () => {
    await run(createRequest(), 200);

    const entry = logSpy.mock.calls[0]?.[0] as { durationMs: unknown };
    expect(typeof entry.durationMs).toBe('number');
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });
});
