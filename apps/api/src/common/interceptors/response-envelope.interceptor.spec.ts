import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { lastValueFrom, of } from 'rxjs';

import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  let reflector: Reflector;
  let getAllAndOverride: jest.SpyInstance;

  beforeEach(() => {
    reflector = new Reflector();
    // Stand in for the decorator metadata that a real controller would carry.
    getAllAndOverride = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(false as never);
  });

  const createContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ correlationId: 'trace-1' }) as unknown as Request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  const run = async (payload: unknown, rawResponse = false): Promise<unknown> => {
    getAllAndOverride.mockReturnValue(rawResponse as never);
    const interceptor = new ResponseEnvelopeInterceptor(reflector);
    const next: CallHandler = { handle: () => of(payload) };
    return lastValueFrom(interceptor.intercept(createContext(), next));
  };

  it('wraps a successful payload in the standard envelope', async () => {
    expect(await run({ id: 'e-1', name: 'Aminah' })).toEqual({
      success: true,
      data: { id: 'e-1', name: 'Aminah' },
      meta: { correlationId: 'trace-1' },
    });
  });

  it('normalises an empty payload to null instead of omitting the data field', async () => {
    expect(await run(undefined)).toEqual({
      success: true,
      data: null,
      meta: { correlationId: 'trace-1' },
    });
  });

  it('passes the payload through untouched for an opted-out route', async () => {
    const payload = { status: 'ok' };
    expect(await run(payload, true)).toBe(payload);
  });

  it('resolves the opt-out flag from the handler and the controller', async () => {
    const handler = () => undefined;
    const controller = class {};
    const context = {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    } as unknown as ExecutionContext;

    const interceptor = new ResponseEnvelopeInterceptor(reflector);
    interceptor.intercept(context, { handle: () => of({}) });

    expect(getAllAndOverride).toHaveBeenCalledWith(RAW_RESPONSE_KEY, [handler, controller]);
  });

  it('propagates an error instead of wrapping it as a success', () => {
    const interceptor = new ResponseEnvelopeInterceptor(reflector);
    const failure = new Error('boom');
    const next: CallHandler = {
      handle: () => {
        throw failure;
      },
    };

    expect(() => interceptor.intercept(createContext(), next)).toThrow(failure);
  });
});