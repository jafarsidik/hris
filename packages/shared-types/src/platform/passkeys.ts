/**
 * WebAuthn passkey vocabulary shared by the API and the web client.
 *
 * The registration/authentication option and response payloads are defined by the
 * WebAuthn spec and produced by `@simplewebauthn`, so they are passed through as
 * opaque JSON here rather than re-typed. Only the account-facing read model lives in
 * this package.
 */

/** A registered passkey, as listed to its owner. Never contains a public key. */
export interface PasskeySummary {
  readonly id: string;
  readonly deviceName: string | null;
  readonly transports: readonly string[];
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
}
