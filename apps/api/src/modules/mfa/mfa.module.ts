import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

/**
 * Multi-factor authentication (System -> Security).
 *
 * `MfaService` is exported because the auth module calls it during sign-in to
 * decide whether a session may be created or a second factor is required.
 */
@Module({
  imports: [LogModule],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
