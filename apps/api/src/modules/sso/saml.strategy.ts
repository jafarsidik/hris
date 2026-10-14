import { Injectable } from '@nestjs/common';
import { IdentityProvider, ServiceProvider } from 'samlify';
import type { IdentityProviderInstance, ServiceProviderInstance } from 'samlify';

import type { SamlProviderConfig, SsoAssertedIdentity } from '@hris/shared-types';

import { UnauthenticatedError, ValidationError } from '../../common/errors/app-error';
import type { SsoSamlClient } from './sso.types';

const HTTP_POST_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';
const HTTP_REDIRECT_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';

/** Attribute names IdPs commonly use for the email claim, in priority order. */
const EMAIL_ATTRIBUTES = [
  'email',
  'mail',
  'emailAddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
] as const;

const EMAIL_VERIFIED_ATTRIBUTES = ['emailVerified', 'email_verified'] as const;

/**
 * `samlify` implementation of {@link SsoSamlClient} for SP-initiated sign-in.
 *
 * Instances are built per request rather than cached because the SP/IdP pair carries
 * the ACS URL, entity ids and certificate, all of which differ per provider; caching
 * by provider id would add a lifecycle to invalidate on every provider edit.
 */
@Injectable()
export class SamlifyStrategy implements SsoSamlClient {
  buildLoginUrl(
    config: SamlProviderConfig,
    request: { acsUrl: string; relayState: string },
  ): string {
    const sp = this.serviceProvider(config, request.acsUrl);
    const idp = this.identityProvider(config);
    const result = sp.createLoginRequest(idp, 'redirect', { relayState: request.relayState });
    return result.context;
  }

  async parseResponse(
    config: SamlProviderConfig,
    request: {
      acsUrl: string;
      http: {
        httpMethod: 'GET' | 'POST';
        query: Readonly<Record<string, string>>;
        body: Readonly<Record<string, string>>;
      };
    },
  ): Promise<SsoAssertedIdentity> {
    const sp = this.serviceProvider(config, request.acsUrl);
    const idp = this.identityProvider(config);
    const binding = request.http.httpMethod === 'POST' ? 'post' : 'redirect';

    let result;
    try {
      result = await sp.parseLoginResponse(idp, binding, {
        query: request.http.query,
        body: request.http.body,
      });
    } catch {
      throw new UnauthenticatedError('The identity provider returned an invalid SAML assertion.');
    }

    const extract = result.extract;
    const subject = typeof extract.nameID === 'string' ? extract.nameID : null;
    if (!subject) {
      throw new UnauthenticatedError('The SAML assertion did not contain a subject.');
    }

    const attributes = extract.attributes ?? {};
    const email = this.firstAttribute(attributes, EMAIL_ATTRIBUTES);
    const verifiedRaw = this.firstAttribute(attributes, EMAIL_VERIFIED_ATTRIBUTES);

    return {
      subject,
      email,
      // SAML assertions arrive over a signed channel from the configured IdP; an
      // explicit negative flag is honoured, otherwise a present email is trusted.
      emailVerified: verifiedRaw === null ? email !== null : verifiedRaw.toLowerCase() !== 'false',
    };
  }

  private firstAttribute(
    attributes: Readonly<Record<string, string | string[]>>,
    names: readonly string[],
  ): string | null {
    for (const name of names) {
      const raw = attributes[name];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
    return null;
  }

  private serviceProvider(config: SamlProviderConfig, acsUrl: string): ServiceProviderInstance {
    return ServiceProvider({
      entityID: config.issuer,
      assertionConsumerService: [{ Binding: HTTP_POST_BINDING, Location: acsUrl }],
      wantAssertionsSigned: true,
    });
  }

  private identityProvider(config: SamlProviderConfig): IdentityProviderInstance {
    if (config.idpCert.trim() === '') {
      throw new ValidationError('The SAML provider is missing its signing certificate.');
    }
    return IdentityProvider({
      entityID: config.idpEntityId ?? config.entryPoint,
      signingCert: config.idpCert,
      singleSignOnService: [{ Binding: HTTP_REDIRECT_BINDING, Location: config.entryPoint }],
    });
  }
}
