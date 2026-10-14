import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LogModule } from '../logs/log.module';
import { OpenidClientStrategy } from './oidc.strategy';
import { SamlifyStrategy } from './saml.strategy';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SSO_OIDC_CLIENT, SSO_SAML_CLIENT } from './sso.types';

/**
 * Single sign-on (System -> Security).
 *
 * The protocol clients are bound to interface tokens so the flow can be exercised
 * end-to-end against deterministic fakes; the real implementations can reach live
 * identity providers. `CryptoModule` is global, so `CredentialCipherService` and the
 * tenant-aware `PrismaService` are available without extra imports.
 */
@Module({
  imports: [LogModule, AuthModule],
  controllers: [SsoController],
  providers: [
    SsoService,
    { provide: SSO_OIDC_CLIENT, useClass: OpenidClientStrategy },
    { provide: SSO_SAML_CLIENT, useClass: SamlifyStrategy },
  ],
  exports: [SsoService],
})
export class SsoModule {}
