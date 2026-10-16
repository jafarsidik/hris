import { Module } from '@nestjs/common';

import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Cross-cutting idempotency shield. Exported as a normal module so the
 * `APP_INTERCEPTOR` registration in the root module can resolve `IdempotencyInterceptor`.
 */
@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
