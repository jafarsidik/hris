import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { Prisma, withTenantContext } from '@hris/database';
import {
  LOG_EVENT_TYPES,
  type IdentityProviderSummary,
  type IdentityProviderType,
  type OidcProviderConfig,
  type SamlProviderConfig,
  type SsoProviderDescriptor,
  type SsoStartResponse,
} from '@hris/shared-types';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import { CredentialCipherService } from '../../common/crypto/credential-cipher.service';
import {
  NotFoundError,
  ServiceUnavailableError,
  UnauthenticatedError,
  ValidationError,
} from '../../common/errors/app-error';
import { AuthService, type LoginContext, type LoginSuccess } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { RedisService } from '../redis/redis.service';
import {
  buildStoredConfig,
  normaliseDomains,
  readOidcConfig,
  readSamlConfig,
  toSummary,
  type ProviderLookupRow,
} from './sso.config';
import {
  SSO_OIDC_CLIENT,
  SSO_SAML_CLIENT,
  type SamlHttpRequest,
  type SsoFlowState,
  type SsoOidcClient,
  type SsoSamlClient,
} from './sso.types';

/** Admin input for creating a provider. */
export interface ProviderCreateInput {
  readonly name: string;
  readonly type: IdentityProviderType;
  readonly enabled?: boolean;
  readonly domains?: readonly string[];
  readonly oidc?: OidcProviderConfig;
  readonly saml?: SamlProviderConfig;
}

/** Every field optional; `type` cannot change once created. */
export type ProviderUpdateInput = Partial<Omit<ProviderCreateInput, 'type'>>;

interface AuthUserLookupRow {
  readonly id: string;
  readonly companyId: string;
  readonly email: string;
  readonly hasVerifiedEmail: boolean;
  readonly status: string;
}

const FLOW_TTL_SECONDS = 10 * 60;

/**
 * Single sign-on (System -> Security).
 *
 * Administrators configure OIDC or SAML providers; users sign in through them. The
 * pre-session flow cannot rely on row-level security (there is no company context),
 * so provider resolution goes through the SECURITY DEFINER functions installed by
 * the `sso_provider_lookups` migration. Transient PKCE/RelayState state lives in
 * Redis for ten minutes and is single-use.
 */
@Injectable()
export class SsoService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(CredentialCipherService) private readonly cipher: CredentialCipherService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SSO_OIDC_CLIENT) private readonly oidc: SsoOidcClient,
    @Inject(SSO_SAML_CLIENT) private readonly saml: SsoSamlClient,
  ) {}

  // ---------------------------------------------------------------------------
  // Administration
  // ---------------------------------------------------------------------------

  async list(companyId: string): Promise<IdentityProviderSummary[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } }),
    );
    return rows.map(toSummary);
  }

  async create(
    companyId: string,
    userId: string,
    input: ProviderCreateInput,
  ): Promise<IdentityProviderSummary> {
    const name = this.requireName(input.name);
    const storedConfig = buildStoredConfig(input.type, input, (plaintext) =>
      this.cipher.encrypt('sso', plaintext),
    );

    const client = this.prisma.getClient();
    const created = await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.create({
        data: {
          companyId,
          name,
          type: input.type,
          enabled: input.enabled ?? true,
          domains: normaliseDomains(input.domains),
          config: storedConfig as Prisma.InputJsonValue,
          createdBy: userId,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['sso.provider_created'],
      actorUserId: userId,
      resource: 'identity-provider',
      resourceId: created.id,
      status: 'SUCCESS',
      metadata: { name, type: input.type },
    });

    return toSummary(created);
  }

  async update(
    companyId: string,
    userId: string,
    providerId: string,
    input: ProviderUpdateInput,
  ): Promise<IdentityProviderSummary> {
    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.findFirst({ where: { id: providerId, companyId } }),
    );
    if (!existing) {
      throw new NotFoundError('Identity provider not found.');
    }

    const data: Prisma.IdentityProviderUpdateInput = {};

    if (input.name !== undefined) {
      data.name = this.requireName(input.name);
    }
    if (input.enabled !== undefined) {
      data.enabled = input.enabled;
    }
    if (input.domains !== undefined) {
      data.domains = normaliseDomains(input.domains);
    }

    if (input.oidc) {
      const current = readOidcConfig(existing.config, (ciphertext) =>
        this.cipher.decrypt('sso', ciphertext),
      );
      const providedSecret =
        input.oidc.clientSecret && input.oidc.clientSecret !== ''
          ? input.oidc.clientSecret
          : current.clientSecret;
      data.config = buildStoredConfig(
        'OIDC',
        {
          oidc: {
            ...current,
            ...input.oidc,
            ...(providedSecret ? { clientSecret: providedSecret } : {}),
          },
        },
        (plaintext) => this.cipher.encrypt('sso', plaintext),
      ) as Prisma.InputJsonValue;
    } else if (input.saml) {
      data.config = buildStoredConfig('SAML', { saml: input.saml }, (plaintext) =>
        this.cipher.encrypt('sso', plaintext),
      ) as Prisma.InputJsonValue;
    }

    const updated = await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.update({ where: { id: providerId }, data }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['sso.provider_updated'],
      actorUserId: userId,
      resource: 'identity-provider',
      resourceId: providerId,
      status: 'SUCCESS',
      metadata: { name: updated.name, type: updated.type },
    });

    return toSummary(updated);
  }

  async remove(companyId: string, userId: string, providerId: string): Promise<void> {
    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.findFirst({ where: { companyId, id: providerId }, select: { id: true } }),
    );
    if (!existing) {
      throw new NotFoundError('Identity provider not found.');
    }

    await withTenantContext(client, companyId, (tx) =>
      tx.identityProvider.delete({ where: { id: providerId } }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['sso.provider_deleted'],
      actorUserId: userId,
      resource: 'identity-provider',
      resourceId: providerId,
      status: 'SUCCESS',
    });
  }

  // ---------------------------------------------------------------------------
  // Public sign-in flow
  // ---------------------------------------------------------------------------

  /** Enabled providers whose configured domains cover the typed email's domain. */
  async providersForEmail(email: string): Promise<SsoProviderDescriptor[]> {
    const normalised = email.trim().toLowerCase();
    if (!normalised.includes('@')) {
      return [];
    }
    const client = this.prisma.getClient();
    return client.$queryRaw<SsoProviderDescriptor[]>(
      Prisma.sql`SELECT "id", "name", "type" FROM app_sso_find_providers_for_email(${normalised}::citext)`,
    );
  }

  async start(providerId: string): Promise<SsoStartResponse> {
    const provider = await this.loadProvider(providerId);
    const acsUrl = this.callbackUrl(providerId);

    if (provider.type === 'OIDC') {
      const oidcConfig = readOidcConfig(provider.config, (ciphertext) =>
        this.cipher.decrypt('sso', ciphertext),
      );
      const state = randomUUID();
      const nonce = randomUUID();
      const codeVerifier = `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
      await this.storeFlow(state, {
        providerId,
        codeVerifier,
        nonce,
        redirectUri: acsUrl,
      });
      const authorizationUrl = await this.oidc.buildAuthorizationUrl(oidcConfig, {
        redirectUri: acsUrl,
        state,
        nonce,
        codeVerifier,
      });
      return { authorizationUrl, state };
    }

    const samlConfig = readSamlConfig(provider.config);
    const relayState = randomUUID();
    await this.storeFlow(relayState, {
      providerId,
      codeVerifier: '',
      nonce: '',
      redirectUri: acsUrl,
    });
    const authorizationUrl = this.saml.buildLoginUrl(samlConfig, { acsUrl, relayState });
    return { authorizationUrl, state: relayState };
  }

  async completeOidc(
    providerId: string,
    query: Readonly<Record<string, string>>,
    context: LoginContext,
  ): Promise<LoginSuccess> {
    const provider = await this.loadProvider(providerId);
    if (provider.type !== 'OIDC') {
      throw new NotFoundError('Identity provider not found.');
    }

    const state = query['state'];
    const code = query['code'];
    if (!state || !code) {
      throw new UnauthenticatedError('The identity provider response is missing required values.');
    }

    const flow = await this.consumeFlow(state);
    if (!flow || flow.providerId !== providerId) {
      throw new UnauthenticatedError('This sign-in attempt has expired. Please start again.');
    }

    const oidcConfig = readOidcConfig(provider.config, (ciphertext) =>
      this.cipher.decrypt('sso', ciphertext),
    );

    try {
      const identity = await this.oidc.exchangeCode(oidcConfig, {
        redirectUri: flow.redirectUri,
        code,
        state,
        nonce: flow.nonce,
        codeVerifier: flow.codeVerifier,
      });
      return await this.resolveAndLogin(provider, identity, context);
    } catch (error) {
      await this.recordLoginFailure(provider.companyId, undefined, context.ipAddress);
      throw error;
    }
  }

  async completeSaml(
    providerId: string,
    http: SamlHttpRequest,
    context: LoginContext,
  ): Promise<LoginSuccess> {
    const provider = await this.loadProvider(providerId);
    if (provider.type !== 'SAML') {
      throw new NotFoundError('Identity provider not found.');
    }

    const relayState = http.body['RelayState'] ?? http.query['RelayState'];
    if (!relayState) {
      throw new UnauthenticatedError('The SAML response is missing its RelayState.');
    }

    const flow = await this.consumeFlow(relayState);
    if (!flow || flow.providerId !== providerId) {
      throw new UnauthenticatedError('This sign-in attempt has expired. Please start again.');
    }

    const samlConfig = readSamlConfig(provider.config);

    try {
      const identity = await this.saml.parseResponse(samlConfig, {
        acsUrl: flow.redirectUri,
        http,
      });
      return await this.resolveAndLogin(provider, identity, context);
    } catch (error) {
      await this.recordLoginFailure(provider.companyId, undefined, context.ipAddress);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async resolveAndLogin(
    provider: ProviderLookupRow,
    identity: { subject: string; email: string | null; emailVerified: boolean },
    context: LoginContext,
  ): Promise<LoginSuccess> {
    const client = this.prisma.getClient();
    const companyId = provider.companyId;

    const linked = await withTenantContext(client, companyId, (tx) =>
      tx.ssoIdentity.findFirst({
        where: { companyId, providerId: provider.id, subject: identity.subject },
        select: { userId: true },
      }),
    );

    let userId = linked?.userId ?? null;

    if (userId === null) {
      userId = await this.linkByEmail(companyId, provider.id, identity);
    }

    await this.logs.recordEvent(companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['sso.login'],
      actorUserId: userId,
      resource: 'identity-provider',
      resourceId: provider.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.auth.loginWithIdentity(userId, companyId, context);
  }

  /** Links an asserted identity to an existing active user, or fails closed. */
  private async linkByEmail(
    companyId: string,
    providerId: string,
    identity: { subject: string; email: string | null; emailVerified: boolean },
  ): Promise<string> {
    if (identity.email === null) {
      throw new UnauthenticatedError(
        'No account on this workspace is linked to your identity provider.',
      );
    }

    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<AuthUserLookupRow[]>(
      Prisma.sql`SELECT "id", "companyId", "email", "hasVerifiedEmail", "status"
                 FROM app_auth_find_user_by_email(${identity.email.toLowerCase()}::citext)`,
    );
    const user = rows[0];

    if (
      user === undefined ||
      user.companyId !== companyId ||
      user.status !== 'ACTIVE' ||
      (!identity.emailVerified && !user.hasVerifiedEmail)
    ) {
      throw new UnauthenticatedError(
        'No account on this workspace is linked to your identity provider. Sign in with your ' +
          'password first, or ask an administrator to link your account.',
      );
    }

    await withTenantContext(client, companyId, (tx) =>
      tx.ssoIdentity.create({
        data: {
          companyId,
          userId: user.id,
          providerId,
          subject: identity.subject,
          email: identity.email,
          createdBy: user.id,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['sso.identity_linked'],
      actorUserId: user.id,
      resource: 'identity-provider',
      resourceId: providerId,
      status: 'SUCCESS',
    });

    return user.id;
  }

  private async recordLoginFailure(
    companyId: string,
    actorUserId: string | undefined,
    ipAddress: string | undefined,
  ): Promise<void> {
    await this.logs.recordEvent(companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['sso.login_failed'],
      actorUserId,
      status: 'DENIED',
      ipAddress,
    });
  }

  private async loadProvider(providerId: string): Promise<ProviderLookupRow> {
    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<ProviderLookupRow[]>(
      Prisma.sql`SELECT * FROM app_sso_find_provider(${providerId}::uuid)`,
    );
    const provider = rows[0];
    if (!provider || !provider.enabled) {
      throw new NotFoundError('Identity provider not found.');
    }
    return provider;
  }

  private callbackUrl(providerId: string): string {
    const base = this.config.secrets.externalBaseUrl;
    if (base === null) {
      throw new ServiceUnavailableError(
        'SSO callbacks require API_PUBLIC_URL so the identity provider can redirect back.',
      );
    }
    return `${base.replace(/\/$/, '')}/api/v1/auth/sso/${providerId}/callback`;
  }

  private requireName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '') {
      throw new ValidationError('A provider name is required.');
    }
    return trimmed;
  }

  private async storeFlow(key: string, state: SsoFlowState): Promise<void> {
    await this.redis
      .getClient()
      .set(this.flowKey(key), JSON.stringify(state), 'EX', FLOW_TTL_SECONDS);
  }

  private async consumeFlow(key: string): Promise<SsoFlowState | null> {
    const client = this.redis.getClient();
    const redisKey = this.flowKey(key);
    const raw = await client.get(redisKey);
    if (raw === null) {
      return null;
    }
    await client.del(redisKey);
    try {
      return JSON.parse(raw) as SsoFlowState;
    } catch {
      return null;
    }
  }

  private flowKey(key: string): string {
    return `sso:flow:${key}`;
  }
}
