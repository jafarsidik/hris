import type {
  IdentityProviderSummary,
  IdentityProviderType,
  OidcProviderConfig,
  SamlProviderConfig,
} from '@hris/shared-types';

import { ValidationError } from '../../common/errors/app-error';

/** A row from `identity_providers` as the service reads it. */
export interface ProviderRow {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
  readonly domains: unknown;
  readonly config: unknown;
  readonly createdAt: Date;
}

/** A provider lookup row from `app_sso_find_provider`. */
export interface ProviderLookupRow {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
  readonly domains: unknown;
  readonly config: unknown;
}

/** Normalises a domain list: trimmed, lower-cased, de-duplicated. */
export function normaliseDomains(input: readonly string[] | undefined): string[] {
  if (!input) {
    return [];
  }
  const seen = new Set<string>();
  for (const domain of input) {
    const normalised = domain.trim().toLowerCase();
    if (normalised !== '') {
      seen.add(normalised);
    }
  }
  return [...seen];
}

/** Reads a stored JSON domain array, tolerating a missing or malformed value. */
export function readDomains(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normaliseDomains(value.filter((item): item is string => typeof item === 'string'));
}

/** Reads and validates an OIDC provider's stored configuration. */
export function readOidcConfig(
  config: unknown,
  decrypt: (ciphertext: string) => string,
): OidcProviderConfig {
  const oidc = asObject(asObject(config)['oidc']);
  const encryptedSecret = typeof oidc['clientSecret'] === 'string' ? oidc['clientSecret'] : null;
  const scopes = Array.isArray(oidc['scopes'])
    ? oidc['scopes'].filter((scope): scope is string => typeof scope === 'string')
    : undefined;

  return {
    issuer: requireString(oidc, 'issuer', 'OIDC issuer'),
    clientId: requireString(oidc, 'clientId', 'OIDC client id'),
    ...(encryptedSecret === null ? {} : { clientSecret: decrypt(encryptedSecret) }),
    ...(scopes === undefined ? {} : { scopes }),
  };
}

/** Reads and validates a SAML provider's stored configuration. */
export function readSamlConfig(config: unknown): SamlProviderConfig {
  const saml = asObject(asObject(config)['saml']);
  const idpEntityId = typeof saml['idpEntityId'] === 'string' ? saml['idpEntityId'] : undefined;

  return {
    entryPoint: requireString(saml, 'entryPoint', 'SAML entry point'),
    issuer: requireString(saml, 'issuer', 'SAML service-provider entity id'),
    idpCert: requireString(saml, 'idpCert', 'SAML signing certificate'),
    ...(idpEntityId === undefined ? {} : { idpEntityId }),
  };
}

/** Whether a stored row has an encrypted OIDC client secret. */
export function hasClientSecret(config: unknown): boolean {
  const oidc = asObject(asObject(config)['oidc']);
  return typeof oidc['clientSecret'] === 'string' && oidc['clientSecret'] !== '';
}

/** The issuer (OIDC) or SP entity id (SAML) for display in the admin list. */
export function displayIssuer(type: IdentityProviderType, config: unknown): string | null {
  const branch = type === 'OIDC' ? 'oidc' : 'saml';
  const value = asObject(asObject(config)[branch])['issuer'];
  return typeof value === 'string' ? value : null;
}

/** Builds the stored JSON `config` for a newly created or updated provider. */
export function buildStoredConfig(
  type: IdentityProviderType,
  input: { oidc?: OidcProviderConfig; saml?: SamlProviderConfig },
  encrypt: (plaintext: string) => string,
): Record<string, unknown> {
  if (type === 'OIDC') {
    if (!input.oidc) {
      throw new ValidationError('OIDC settings are required for an OIDC provider.');
    }
    const { issuer, clientId, clientSecret, scopes } = input.oidc;
    requireString({ issuer }, 'issuer', 'OIDC issuer');
    requireString({ clientId }, 'clientId', 'OIDC client id');
    return {
      oidc: {
        issuer,
        clientId,
        ...(clientSecret === undefined || clientSecret === ''
          ? {}
          : { clientSecret: encrypt(clientSecret) }),
        ...(scopes === undefined ? {} : { scopes }),
      },
    };
  }

  if (!input.saml) {
    throw new ValidationError('SAML settings are required for a SAML provider.');
  }
  const { entryPoint, issuer, idpCert, idpEntityId } = input.saml;
  requireString({ entryPoint }, 'entryPoint', 'SAML entry point');
  requireString({ issuer }, 'issuer', 'SAML service-provider entity id');
  requireString({ idpCert }, 'idpCert', 'SAML signing certificate');
  return {
    saml: { entryPoint, issuer, idpCert, ...(idpEntityId === undefined ? {} : { idpEntityId }) },
  };
}

/** Maps a row to the secret-free admin summary. */
export function toSummary(row: ProviderRow): IdentityProviderSummary {
  const type = row.type as IdentityProviderType;
  return {
    id: row.id,
    name: row.name,
    type,
    enabled: row.enabled,
    domains: readDomains(row.domains),
    hasClientSecret: hasClientSecret(row.config),
    issuer: displayIssuer(type, row.config),
    createdAt: row.createdAt.toISOString(),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireString(source: Record<string, unknown>, key: string, label: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${label} is required.`);
  }
  return value.trim();
}
