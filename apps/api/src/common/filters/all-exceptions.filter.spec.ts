import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

import { AppError, NotFoundError, OutOfScopeError, ValidationError } from '../errors/app-error';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

const createHost = (
  correlationId = 'test-correlation-id',
): {
  host: ArgumentsHost;
  captured: CapturedResponse;
} => {
  const captured: CapturedResponse = { statusCode: 0, body: undefined };

  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  };

  const request = {
    method: 'GET',
    path: '/employees',
    ip: '10.0.0.1',
    correlationId,
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // Keep expected-failure output out of the test reporter.
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
  });

  describe('expected domain failures', () => {
    it('passes an AppError through with its status, code and message', () => {
      const { host, captured } = createHost();

      filter.catch(new NotFoundError('Employee not found'), host);

      expect(captured.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(captured.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
          details: undefined,
          correlationId: 'test-correlation-id',
        },
      });
    });

    it('returns field-level validation details', () => {
      const { host, captured } = createHost();

      filter.catch(
        new ValidationError('Invalid request', [{ field: 'email', message: 'must be an email' }]),
        host,
      );

      expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(captured.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'email', message: 'must be an email' }],
        },
      });
    });

    it('reports an out-of-scope request with its own code', () => {
      const { host, captured } = createHost();

      filter.catch(new OutOfScopeError(), host);

      expect(captured.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(captured.body).toMatchObject({ error: { code: 'OUT_OF_SCOPE' } });
    });

    it('never serialises internal error context to the client', () => {
      const { host, captured } = createHost();

      filter.catch(
        new AppError('Employee not found', HttpStatus.NOT_FOUND, 'NOT_FOUND', {
          context: { sql: 'SELECT * FROM employee', employeeId: 'e-1' },
        }),
        host,
      );

      expect(captured.statusCode).toBe(HttpStatus.NOT_FOUND);
      const serialised = JSON.stringify(captured.body);
      expect(serialised).not.toContain('SELECT');
      expect(serialised).not.toContain('employeeId');
    });
  });

  describe('framework exceptions', () => {
    it('maps an HttpException onto the matching error code', () => {
      const { host, captured } = createHost();

      filter.catch(new HttpException('Forbidden resource', HttpStatus.FORBIDDEN), host);

      expect(captured.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(captured.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Forbidden resource' },
      });
    });

    it('maps an unmapped status onto INTERNAL_ERROR without losing the status', () => {
      const { host, captured } = createHost();

      filter.catch(new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT), host);

      expect(captured.statusCode).toBe(HttpStatus.I_AM_A_TEAPOT);
      expect(captured.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    });
  });

  describe('unexpected failures', () => {
    it.each([
      ['a database driver error', new Error('connect ECONNREFUSED 10.0.0.5:5432')],
      ['a plain string', 'something broke'],
      ['undefined', undefined],
      ['a plain object', { message: 'nope' }],
    ])('hides the details of %s behind a generic error', (_description, exception) => {
      const { host, captured } = createHost();

      filter.catch(exception, host);

      expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(captured.body).toMatchObject({
        success: false,
        error: { code: 'INTERNAL_ERROR' },
      });

      const serialised = JSON.stringify(captured.body);
      expect(serialised).not.toContain('ECONNREFUSED');
      expect(serialised).not.toContain('10.0.0.5');
      expect(serialised).not.toContain('stack');
    });

    it('still returns a correlation id so the client can quote it in a support request', () => {
      const { host, captured } = createHost('incident-42');

      filter.catch(new Error('boom'), host);

      expect(captured.body).toMatchObject({
        error: { correlationId: 'incident-42' },
      });
    });
  });
});
