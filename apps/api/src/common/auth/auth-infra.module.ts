import { Global, Module } from '@nestjs/common';

import { RateLimiter } from '../rate-limit/rate-limiter.service';
import { ApiClientAuthenticator } from './api-client-authenticator.service';
import { PasswordService } from './password.service';
import { PermissionService } from './permission.service';
import { SESSION_STORE, RedisSessionStore } from './session.store';

/**
 * Auth infrastructure shared by the guards and every module that needs the caller's
 * capability set.
 *
 * Global so the global guards (registered as APP_GUARD in `AppModule`) can depend on
 * these providers without importing a module; every module already gets them.
 */
@Global()
@Module({
  providers: [
    PasswordService,
    PermissionService,
    ApiClientAuthenticator,
    RateLimiter,
    { provide: SESSION_STORE, useClass: RedisSessionStore },
  ],
  exports: [PasswordService, PermissionService, ApiClientAuthenticator, RateLimiter, SESSION_STORE],
})
export class AuthInfraModule {}
