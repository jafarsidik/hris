import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LogModule } from '../logs/log.module';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { SimpleWebAuthnAdapter } from './simplewebauthn.adapter';
import { WEBAUTHN_ADAPTER } from './webauthn.types';

/**
 * Passkeys (System -> Security).
 *
 * The WebAuthn client is bound to an interface token so the flow can be exercised
 * end-to-end against deterministic fakes; the real implementation verifies live
 * authenticator signatures. `CryptoModule` is global, so the tenant-aware
 * `PrismaService` and `RedisService` are available without extra imports.
 */
@Module({
  imports: [AuthModule, LogModule],
  controllers: [PasskeyController],
  providers: [PasskeyService, { provide: WEBAUTHN_ADAPTER, useClass: SimpleWebAuthnAdapter }],
  exports: [PasskeyService],
})
export class PasskeyModule {}
