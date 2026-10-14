import { Global, Module } from '@nestjs/common';

import { CredentialCipherService } from './credential-cipher.service';

/**
 * At-rest encryption for credentials (TOTP seeds, SSO secrets).
 *
 * Global so the MFA and SSO modules can encrypt/decrypt without importing a
 * module whose only content is this one service.
 */
@Global()
@Module({
  providers: [CredentialCipherService],
  exports: [CredentialCipherService],
})
export class CryptoModule {}
