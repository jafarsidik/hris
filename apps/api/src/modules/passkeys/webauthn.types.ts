/**
 * The WebAuthn operations the passkey service needs, behind an interface.
 *
 * `@simplewebauthn/server` verifies cryptographic signatures against real
 * authenticators, which cannot be produced in a test. Binding the adapter to a token
 * lets end-to-end tests substitute deterministic fakes while the real implementation
 * remains the default.
 */
export const WEBAUTHN_ADAPTER = Symbol('WEBAUTHN_ADAPTER');

/** A verified registration, ready to persist. */
export interface VerifiedRegistration {
  readonly credentialId: string;
  /** The COSE public key, base64url-encoded for storage. */
  readonly publicKey: string;
  readonly counter: number;
  readonly deviceType: string | null;
  readonly transports: readonly string[];
}

export interface RegistrationVerification {
  readonly verified: boolean;
  readonly registration?: VerifiedRegistration;
}

export interface AuthenticationVerification {
  readonly verified: boolean;
  readonly newCounter?: number;
}

/** A stored credential as the adapter needs it to verify an assertion. */
export interface StoredCredential {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[];
}

/** WebAuthn relying-party client, wrapping `@simplewebauthn/server`. */
export interface WebAuthnAdapter {
  generateRegistrationOptions(input: {
    readonly rpName: string;
    readonly rpID: string;
    readonly userName: string;
    readonly userDisplayName: string;
    readonly excludeCredentials: readonly { id: string; transports?: string[] }[];
  }): Promise<Record<string, unknown>>;

  verifyRegistration(input: {
    readonly response: unknown;
    readonly expectedChallenge: string;
    readonly expectedOrigin: string;
    readonly expectedRPID: string;
  }): Promise<RegistrationVerification>;

  generateAuthenticationOptions(input: {
    readonly rpID: string;
    readonly allowCredentials: readonly { id: string; transports?: string[] }[];
  }): Promise<Record<string, unknown>>;

  verifyAuthentication(input: {
    readonly response: unknown;
    readonly expectedChallenge: string;
    readonly expectedOrigin: string;
    readonly expectedRPID: string;
    readonly credential: StoredCredential;
  }): Promise<AuthenticationVerification>;
}
