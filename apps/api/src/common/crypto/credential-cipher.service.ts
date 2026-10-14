import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import { ServiceUnavailableError } from '../errors/app-error';

/** Which configured key encrypts a value. Each scope has its own key. */
export type SecretScope = 'mfa' | 'sso' | 'webhook';

const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts credentials the platform must be able to read back (TOTP seeds, SSO
 * client secrets and SAML private keys) with AES-256-GCM.
 *
 * The plaintext is never logged and never stored; only the `iv:tag:ciphertext`
 * envelope is. A missing key is a hard error at the point of use rather than a
 * silent fallback to plaintext, because a plaintext TOTP secret defeats the
 * second factor entirely.
 */
@Injectable()
export class CredentialCipherService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  encrypt(scope: SecretScope, plaintext: string): string {
    const key = this.requireKey(scope);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
  }

  decrypt(scope: SecretScope, envelope: string): string {
    const key = this.requireKey(scope);
    const [ivPart, tagPart, ciphertextPart] = envelope.split('.');
    if (!ivPart || !tagPart || !ciphertextPart) {
      throw new ServiceUnavailableError('Stored credential is not a valid ciphertext envelope.');
    }
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Whether the scope's key is configured; callers use it to present a clear state. */
  isConfigured(scope: SecretScope): boolean {
    return this.rawKey(scope) !== null;
  }

  private rawKey(scope: SecretScope): string | null {
    switch (scope) {
      case 'mfa':
        return this.config.secrets.mfaEncryptionKey;
      case 'sso':
        return this.config.secrets.ssoEncryptionKey;
      case 'webhook':
        return this.config.secrets.webhookEncryptionKey;
    }
  }

  /**
   * Derives the 32-byte AES key. The raw environment value is hashed rather than
   * used directly so an operator-supplied passphrase of any length is accepted;
   * the SHA-256 step is the key schedule, not the entropy source.
   */
  private requireKey(scope: SecretScope): Buffer {
    const raw = this.rawKey(scope);
    if (raw === null) {
      const message =
        scope === 'mfa'
          ? 'MFA is not configured: set AUTH_MFA_ENCRYPTION_KEY before enrolling factors.'
          : scope === 'sso'
            ? 'SSO is not configured: set SSO_ENCRYPTION_KEY before configuring identity providers.'
            : 'Webhooks are not configured: set WEBHOOK_ENCRYPTION_KEY before registering a webhook endpoint.';
      throw new ServiceUnavailableError(message);
    }
    return createHash('sha256').update(raw, 'utf8').digest();
  }
}
