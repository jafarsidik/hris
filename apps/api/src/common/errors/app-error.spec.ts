import { HttpException, HttpStatus } from '@nestjs/common';

import {
  AppError,
  ForbiddenError,
  NotFoundError,
  OutOfScopeError,
  UnauthenticatedError,
  ValidationError,
  isAppError,
} from './app-error';

describe('AppError', () => {
  it('carries an HTTP status and a stable machine-readable code', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.isOperational).toBe(true);
  });

  it('names the concrete subclass so logs identify the failure kind', () => {
    expect(new ForbiddenError().name).toBe('ForbiddenError');
    expect(new ValidationError().name).toBe('ValidationError');
  });

  it('exposes field-level details when supplied', () => {
    const error = new ValidationError('Invalid leave request', [
      { field: 'startDate', message: 'must not be in the past' },
    ]);

    expect(error.details).toEqual([{ field: 'startDate', message: 'must not be in the past' }]);
  });

  it('distinguishes an out-of-scope access from a plain denial', () => {
    const error = new OutOfScopeError();

    expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
    // A distinct code lets monitoring detect cross-entity access attempts.
    expect(error.code).toBe('OUT_OF_SCOPE');
    expect(error.code).not.toBe(new ForbiddenError().code);
  });

  it('retains the original cause for server-side diagnostics', () => {
    const cause = new Error('connection reset');
    const error = new UnauthenticatedError('token expired');

    expect(error.cause).toBeUndefined();
    expect(new AppError('wrapped', 500, 'INTERNAL_ERROR', { cause }).cause).toBe(cause);
  });

  it('is not an HttpException, keeping domain errors framework-independent', () => {
    expect(new NotFoundError()).not.toBeInstanceOf(HttpException);
  });
});

describe('isAppError', () => {
  it('recognises domain errors and rejects everything else', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError(new HttpException('nope', HttpStatus.FORBIDDEN))).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError('a string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
