import {
  buildStoredConfig,
  displayIssuer,
  hasClientSecret,
  normaliseDomains,
  readDomains,
  readOidcConfig,
  readSamlConfig,
  toSummary,
  type ProviderRow,
} from './sso.config';

const encrypt = (plaintext: string): string => `enc(${plaintext})`;
const decrypt = (ciphertext: string): string =>
  ciphertext.startsWith('enc(') ? ciphertext.slice(4, -1) : ciphertext;

describe('sso.config', () => {
  describe('normaliseDomains', () => {
    it('trims, lower-cases, de-duplicates and drops blanks', () => {
      expect(normaliseDomains([' ACME.com ', 'acme.com', '', '  ', 'Beta.io'])).toEqual([
        'acme.com',
        'beta.io',
      ]);
    });

    it('returns an empty list when undefined', () => {
      expect(normaliseDomains(undefined)).toEqual([]);
    });
  });

  describe('readDomains', () => {
    it('ignores non-array and non-string members', () => {
      expect(readDomains(null)).toEqual([]);
      expect(readDomains(['A.com', 42, 'a.com'])).toEqual(['a.com']);
    });
  });

  describe('buildStoredConfig', () => {
    it('encrypts an OIDC client secret and round-trips through read', () => {
      const stored = buildStoredConfig(
        'OIDC',
        {
          oidc: {
            issuer: 'https://idp.example',
            clientId: 'client-1',
            clientSecret: 'super-secret',
            scopes: ['openid', 'email'],
          },
        },
        encrypt,
      );

      expect(hasClientSecret(stored)).toBe(true);
      const parsed = readOidcConfig(stored, decrypt);
      expect(parsed).toEqual({
        issuer: 'https://idp.example',
        clientId: 'client-1',
        clientSecret: 'super-secret',
        scopes: ['openid', 'email'],
      });
    });

    it('omits the secret entirely when none is supplied', () => {
      const stored = buildStoredConfig(
        'OIDC',
        { oidc: { issuer: 'https://idp.example', clientId: 'client-1' } },
        encrypt,
      );
      expect(hasClientSecret(stored)).toBe(false);
      expect(readOidcConfig(stored, decrypt).clientSecret).toBeUndefined();
    });

    it('stores SAML settings', () => {
      const stored = buildStoredConfig(
        'SAML',
        {
          saml: {
            entryPoint: 'https://idp.example/sso',
            issuer: 'https://sp.example',
            idpCert: 'CERT',
          },
        },
        encrypt,
      );
      expect(readSamlConfig(stored)).toEqual({
        entryPoint: 'https://idp.example/sso',
        issuer: 'https://sp.example',
        idpCert: 'CERT',
      });
    });

    it('rejects a provider without its protocol settings', () => {
      expect(() => buildStoredConfig('OIDC', {}, encrypt)).toThrow(/OIDC settings/);
      expect(() => buildStoredConfig('SAML', {}, encrypt)).toThrow(/SAML settings/);
    });
  });

  describe('toSummary', () => {
    const row: ProviderRow = {
      id: 'provider-1',
      companyId: 'company-1',
      name: 'Acme SSO',
      type: 'OIDC',
      enabled: true,
      domains: ['acme.com'],
      config: { oidc: { issuer: 'https://idp.example', clientId: 'c', clientSecret: 'enc(x)' } },
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    };

    it('never exposes the client secret', () => {
      const summary = toSummary(row);
      expect(summary).toEqual({
        id: 'provider-1',
        name: 'Acme SSO',
        type: 'OIDC',
        enabled: true,
        domains: ['acme.com'],
        hasClientSecret: true,
        issuer: 'https://idp.example',
        createdAt: '2026-01-02T03:04:05.000Z',
      });
      expect(JSON.stringify(summary)).not.toContain('enc(x)');
    });
  });

  describe('displayIssuer', () => {
    it('reads the issuer for OIDC and the SP entity id for SAML', () => {
      expect(displayIssuer('OIDC', { oidc: { issuer: 'iss' } })).toBe('iss');
      expect(displayIssuer('SAML', { saml: { issuer: 'sp' } })).toBe('sp');
      expect(displayIssuer('OIDC', null)).toBeNull();
    });
  });
});
