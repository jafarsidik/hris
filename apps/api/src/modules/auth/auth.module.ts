import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { MfaModule } from '../mfa/mfa.module';
import { NotificationModule } from '../notifications/notification.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Authentication and session endpoints (brief, Authentication).
 *
 * Shared auth primitives (session store, password hashing, principal resolution)
 * live in the global AuthInfraModule; this module is purely the HTTP surface plus
 * the service that orchestrates the security-relevant state changes.
 */
@Module({
  imports: [LogModule, NotificationModule, MfaModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
