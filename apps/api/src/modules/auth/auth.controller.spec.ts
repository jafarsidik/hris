import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { AuthController } from './auth.controller';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';

const paramtypesOf = (method: string): readonly unknown[] =>
  (Reflect.getMetadata('design:paramtypes', AuthController.prototype, method) as
    readonly unknown[] | undefined) ?? [];

const BODY_ENDPOINTS: readonly (readonly [string, number, unknown])[] = [
  ['login', 2, LoginDto],
  ['register', 1, RegisterDto],
  ['forgotPassword', 1, ForgotPasswordDto],
  ['resetPassword', 1, ResetPasswordDto],
  ['verifyEmail', 1, VerifyEmailDto],
  ['changePassword', 2, ChangePasswordDto],
];

/**
 * `design:paramtypes` is what Nest hands to the global ValidationPipe, and TypeScript only
 * emits the real class when the DTO import is a value import. With `import type` the
 * reference degrades to `Object`/`Function`: Nest then validates against a class with no
 * rules, `forbidNonWhitelisted` rejects every field, and every endpoint here answers
 * 400 VALIDATION_ERROR for a valid payload. Unit and e2e tests cannot see it (a missing
 * metatype makes Nest skip validation silently), so this asserts the emitted metadata.
 */
describe('AuthController @Body() metadata', () => {
  for (const [method, index, dto] of BODY_ENDPOINTS) {
    it(`keeps ${method}()'s @Body DTO class in paramtypes`, () => {
      expect(paramtypesOf(method)[index]).toBe(dto);
    });
  }

  it('accepts a valid login body through the pipe Nest uses', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    });

    const body = { email: 'admin@hris.test', password: 'Str0ng-Passw0rd!' };
    await expect(
      pipe.transform(body, {
        type: 'body',
        metatype: paramtypesOf('login')[2] as typeof LoginDto,
        data: '',
      }),
    ).resolves.toEqual(body);
  });
});
