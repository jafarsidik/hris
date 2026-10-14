import type {
  OidcProviderConfig,
  SamlProviderConfig,
  SsoAssertedIdentity,
} from '@hris/shared-types';

/**
 * Injection tokens for the protocol clients.
 *
 * The OIDC and SAML implementations are behind interfaces so the flow logic can be
 * unit- and end-to-end-tested with deterministic fakes instead of a live identity
 * provider: `openid-client` performs network discovery that no test should depend on.
 */
export const SSO_OIDC_CLIENT = Symbol('SSO_OIDC_CLIENT');
export const SSO_SAML_CLIENT = Symbol('SSO_SAML_CLIENT');

/** Inputs the service supplies when building an OIDC authorization redirect. */
export interface OidcAuthorizationRequest {
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

/** Inputs for the authorization-code exchange after the IdP redirects back. */
export interface OidcCodeExchange {
  readonly redirectUri: string;
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

/** Builds and validates OpenID Connect authorization-code (PKCE) flows. */
export interface SsoOidcClient {
  buildAuthorizationUrl(
    config: OidcProviderConfig,
    request: OidcAuthorizationRequest,
  ): Promise<string>;
  exchangeCode(
    config: OidcProviderConfig,
    exchange: OidcCodeExchange,
  ): Promise<SsoAssertedIdentity>;
}

/** The transport-independent shape of the IdP's callback request. */
export interface SamlHttpRequest {
  readonly httpMethod: 'GET' | 'POST';
  readonly query: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, string>>;
}

/** Builds SP-initiated SAML requests and validates the returned assertion. */
export interface SsoSamlClient {
  buildLoginUrl(
    config: SamlProviderConfig,
    request: { acsUrl: string; relayState: string },
  ): string;
  parseResponse(
    config: SamlProviderConfig,
    request: { acsUrl: string; http: SamlHttpRequest },
  ): Promise<SsoAssertedIdentity>;
}

/** The transient per-login state persisted between `start` and `callback`. */
export interface SsoFlowState {
  readonly providerId: string;
  readonly codeVerifier: string;
  readonly nonce: string;
  readonly redirectUri: string;
}
