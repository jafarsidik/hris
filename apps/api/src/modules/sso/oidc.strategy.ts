import { Injectable } from '@nestjs/common';

import type { OidcProviderConfig, SsoAssertedIdentity } from '@hris/shared-types';

import { UnauthenticatedError } from '../../common/errors/app-error';
import type { OidcAuthorizationRequest, OidcCodeExchange, SsoOidcClient } from './sso.types';

const DEFAULT_SCOPES = ['openid', 'profile', 'email'] as const;

/**
 * `openid-client` implementation of {@link SsoOidcClient}.
 *
 * The library is ESM-only and its discovery call reaches the network, so it is
 * imported lazily: an application that never enables an OIDC provider pays nothing
 * for it, and a missing endpoint fails at the point of use with a domain error
 * rather than at boot.
 */
@Injectable()
export class OpenidClientStrategy implements SsoOidcClient {
  async buildAuthorizationUrl(
    config: OidcProviderConfig,
    request: OidcAuthorizationRequest,
  ): Promise<string> {
    const oidc = await import('openid-client');
    const client = await this.configuration(config);
    const codeChallenge = await oidc.calculatePKCECodeChallenge(request.codeVerifier);

    return oidc.buildAuthorizationUrl(client, {
      redirect_uri: request.redirectUri,
      scope: (config.scopes ?? DEFAULT_SCOPES).join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: request.state,
      nonce: request.nonce,
    }).href;
  }

  async exchangeCode(
    config: OidcProviderConfig,
    exchange: OidcCodeExchange,
  ): Promise<SsoAssertedIdentity> {
    const oidc = await import('openid-client');
    const client = await this.configuration(config);

    const currentUrl = new URL(exchange.redirectUri);
    currentUrl.searchParams.set('code', exchange.code);
    currentUrl.searchParams.set('state', exchange.state);

    let tokens;
    try {
      tokens = await oidc.authorizationCodeGrant(client, currentUrl, {
        pkceCodeVerifier: exchange.codeVerifier,
        expectedState: exchange.state,
        expectedNonce: exchange.nonce,
      });
    } catch {
      throw new UnauthenticatedError('The identity provider rejected the sign-in attempt.');
    }

    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== 'string') {
      throw new UnauthenticatedError('The identity provider returned an invalid token.');
    }

    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
    };
  }

  private async configuration(config: OidcProviderConfig) {
    const oidc = await import('openid-client');
    return oidc.discovery(new URL(config.issuer), config.clientId, config.clientSecret);
  }
}
