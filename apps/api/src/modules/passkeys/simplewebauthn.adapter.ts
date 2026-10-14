import { Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

import type {
  AuthenticationVerification,
  RegistrationVerification,
  StoredCredential,
  WebAuthnAdapter,
} from './webauthn.types';

const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const fromBase64Url = (value: string) => {
  const decoded = Buffer.from(value, 'base64url');
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return bytes;
};

/**
 * Real `@simplewebauthn/server` adapter.
 *
 * Public keys cross this boundary as base64url strings because the database column is
 * text; the library works in `Uint8Array`, so the conversions are contained here. A
 * registration is only reported verified when the library verified it and exposed the
 * credential, so callers cannot persist an unverified key.
 */
@Injectable()
export class SimpleWebAuthnAdapter implements WebAuthnAdapter {
  async generateRegistrationOptions(input: {
    rpName: string;
    rpID: string;
    userName: string;
    userDisplayName: string;
    excludeCredentials: readonly { id: string; transports?: string[] }[];
  }): Promise<Record<string, unknown>> {
    const options = await generateRegistrationOptions({
      rpName: input.rpName,
      rpID: input.rpID,
      userName: input.userName,
      userDisplayName: input.userDisplayName,
      excludeCredentials: input.excludeCredentials.map((credential) => ({
        id: credential.id,
        ...(credential.transports === undefined ? {} : { transports: credential.transports }),
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    return options as unknown as Record<string, unknown>;
  }

  async verifyRegistration(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRPID: string;
  }): Promise<RegistrationVerification> {
    const result = await verifyRegistrationResponse({
      response: input.response as RegistrationResponseJSON,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: input.expectedRPID,
      requireUserVerification: false,
    });

    if (!result.verified || !result.registrationInfo) {
      return { verified: false };
    }

    const { credential, credentialDeviceType } = result.registrationInfo;
    return {
      verified: true,
      registration: {
        credentialId: credential.id,
        publicKey: toBase64Url(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType ?? null,
        transports: credential.transports ?? [],
      },
    };
  }

  async generateAuthenticationOptions(input: {
    rpID: string;
    allowCredentials: readonly { id: string; transports?: string[] }[];
  }): Promise<Record<string, unknown>> {
    const options = await generateAuthenticationOptions({
      rpID: input.rpID,
      allowCredentials: input.allowCredentials.map((credential) => ({
        id: credential.id,
        ...(credential.transports === undefined
          ? {}
          : { transports: credential.transports as never }),
      })),
      userVerification: 'preferred',
    });
    return options as unknown as Record<string, unknown>;
  }

  async verifyAuthentication(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRPID: string;
    credential: StoredCredential;
  }): Promise<AuthenticationVerification> {
    const result = await verifyAuthenticationResponse({
      response: input.response as AuthenticationResponseJSON,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: input.expectedRPID,
      credential: {
        id: input.credential.credentialId,
        publicKey: fromBase64Url(input.credential.publicKey),
        counter: input.credential.counter,
        transports: input.credential.transports as never,
      },
      requireUserVerification: false,
    });

    return { verified: result.verified, newCounter: result.authenticationInfo.newCounter };
  }
}
