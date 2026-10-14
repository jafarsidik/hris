/**
 * Enterprise SSO vocabulary shared by the API and the web client.
 *
 * Providers are account-scoped administrators' objects; the login flow is public
 * (it runs before a session exists), so the read models here deliberately expose
 * only what a sign-in page and an admin list need. Secrets never leave the API:
 * {@link IdentityProviderSummary} reports `hasClientSecret` instead of the value.
 */

/** The protocols a provider may speak; mirrors the `IdentityProviderType` enum. */
export const IDENTITY_PROVIDER_TYPES = ['OIDC', 'SAML'] as const;
export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];

/** OpenID Connect settings; `clientSecret` is encrypted at rest. */
export interface OidcProviderConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  /** Defaults to `openid profile email` when omitted. */
  readonly scopes?: readonly string[];
}

/** SAML 2.0 settings for a service-provider-initiated flow. */
export interface SamlProviderConfig {
  /** IdP Single Sign-On endpoint the browser is redirected to. */
  readonly entryPoint: string;
  /** Service-provider entity id, sent as the `Issuer`. */
  readonly issuer: string;
  /** IdP X.509 signing certificate (PEM); public, stored in the clear. */
  readonly idpCert: string;
  /** IdP entity id; defaults to `entryPoint` when omitted. */
  readonly idpEntityId?: string;
}

/** Protocol-specific settings keyed by {@link IdentityProviderType}. */
export interface IdentityProviderConfig {
  readonly oidc?: OidcProviderConfig;
  readonly saml?: SamlProviderConfig;
}

/** Admin list row. Never contains a secret, only whether one is set. */
export interface IdentityProviderSummary {
  readonly id: string;
  readonly name: string;
  readonly type: IdentityProviderType;
  readonly enabled: boolean;
  readonly domains: readonly string[];
  readonly hasClientSecret: boolean;
  /** Issuer (OIDC) or SP entity id (SAML) for display. */
  readonly issuer: string | null;
  readonly createdAt: string;
}

/** Public descriptor shown on the sign-in page; no configuration leaks. */
export interface SsoProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: IdentityProviderType;
}

/** Returned by `start`; the client navigates the browser to `authorizationUrl`. */
export interface SsoStartResponse {
  readonly authorizationUrl: string;
  readonly state: string;
}

/** The identity an IdP asserted, normalised across protocols. */
export interface SsoAssertedIdentity {
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
}
