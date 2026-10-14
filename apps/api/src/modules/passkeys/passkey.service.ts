import { Inject, Injectable } from '@nestjs/common';

import { Prisma, withTenantContext } from '@hris/database';
import { LOG_EVENT_TYPES, type PasskeySummary } from '@hris/shared-types';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import {
  NotFoundError,
  ServiceUnavailableError,
  UnauthenticatedError,
} from '../../common/errors/app-error';
import { AuthService, type LoginContext, type LoginSuccess } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { RedisService } from '../redis/redis.service';
import { WEBAUTHN_ADAPTER, type WebAuthnAdapter } from './webauthn.types';

interface UserLookupRow {
  readonly id: string;
  readonly companyId: string;
  readonly email: string;
  readonly status: string;
}

const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * WebAuthn passkeys (System -> Security).
 *
 * Registration is self-service for a signed-in user; authentication is public and
 * returns a session, so the challenge is stored single-use in Redis and the asserted
 * counter is persisted to detect cloned authenticators. Public keys are stored as
 * base64url text because they are not secret (they are useless without the private
 * key that never leaves the device).
 */
@Injectable()
export class PasskeyService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(WEBAUTHN_ADAPTER) private readonly webauthn: WebAuthnAdapter,
  ) {}

  async list(companyId: string, userId: string): Promise<PasskeySummary[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.authenticator.findMany({
        where: { companyId, userId },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return rows.map((row) => ({
      id: row.id,
      deviceName: row.deviceName,
      transports: this.readTransports(row.transports),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async registrationOptions(
    companyId: string,
    userId: string,
    email: string,
    displayName: string,
  ): Promise<Record<string, unknown>> {
    const rp = this.relyingParty();
    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.authenticator.findMany({
        where: { companyId, userId },
        select: { credentialId: true, transports: true },
      }),
    );

    const options = await this.webauthn.generateRegistrationOptions({
      rpName: rp.rpName,
      rpID: rp.rpId,
      userName: email,
      userDisplayName: displayName,
      excludeCredentials: existing.map((row) => ({
        id: row.credentialId,
        transports: this.readTransports(row.transports),
      })),
    });

    await this.storeChallenge(`reg:${userId}`, options['challenge'] as string, {
      companyId,
      userId,
    });
    return options;
  }

  async verifyRegistration(
    companyId: string,
    userId: string,
    response: unknown,
    deviceName: string | null,
  ): Promise<PasskeySummary> {
    const rp = this.relyingParty();
    const challenge = await this.consumeChallenge(`reg:${userId}`);
    if (challenge === null) {
      throw new UnauthenticatedError('This registration attempt has expired. Please try again.');
    }

    const result = await this.webauthn.verifyRegistration({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
    });
    if (!result.verified || !result.registration) {
      throw new UnauthenticatedError('The passkey could not be verified.');
    }

    const registration = result.registration;
    const client = this.prisma.getClient();
    const created = await withTenantContext(client, companyId, (tx) =>
      tx.authenticator.create({
        data: {
          companyId,
          userId,
          credentialId: registration.credentialId,
          publicKey: registration.publicKey,
          counter: BigInt(registration.counter),
          transports: registration.transports as unknown as Prisma.InputJsonValue,
          deviceName,
          createdBy: userId,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['passkey.registered'],
      actorUserId: userId,
      resource: 'authenticator',
      resourceId: created.id,
      status: 'SUCCESS',
      metadata: { deviceType: registration.deviceType, deviceName },
    });

    return {
      id: created.id,
      deviceName: created.deviceName,
      transports: this.readTransports(created.transports),
      lastUsedAt: null,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async authenticationOptions(email: string): Promise<Record<string, unknown>> {
    const rp = this.relyingParty();
    const user = await this.findActiveUser(email);

    const client = this.prisma.getClient();
    const authenticators = await withTenantContext(client, user.companyId, (tx) =>
      tx.authenticator.findMany({
        where: { companyId: user.companyId, userId: user.id },
        select: { credentialId: true, transports: true },
      }),
    );

    if (authenticators.length === 0) {
      throw new UnauthenticatedError('No passkey is registered for this account.');
    }

    const options = await this.webauthn.generateAuthenticationOptions({
      rpID: rp.rpId,
      allowCredentials: authenticators.map((row) => ({
        id: row.credentialId,
        transports: this.readTransports(row.transports),
      })),
    });

    await this.storeChallenge(
      `auth:${options['challenge'] as string}`,
      options['challenge'] as string,
      {
        companyId: user.companyId,
        userId: user.id,
      },
    );
    return options;
  }

  async verifyAuthentication(response: unknown, context: LoginContext): Promise<LoginSuccess> {
    const rp = this.relyingParty();
    const credentialId = this.readCredentialId(response);
    if (credentialId === null) {
      throw new UnauthenticatedError('The passkey response is malformed.');
    }

    const challengeValue = this.readChallenge(response);
    if (challengeValue === null) {
      throw new UnauthenticatedError('The passkey response is malformed.');
    }

    const flow = await this.consumeChallenge(`auth:${challengeValue}`);
    if (flow === null) {
      throw new UnauthenticatedError('This sign-in attempt has expired. Please try again.');
    }

    const client = this.prisma.getClient();
    const authenticator = await withTenantContext(client, flow.companyId, (tx) =>
      tx.authenticator.findFirst({
        where: { companyId: flow.companyId, credentialId },
      }),
    );
    if (!authenticator) {
      throw new UnauthenticatedError('This passkey is not registered.');
    }

    const result = await this.webauthn.verifyAuthentication({
      response,
      expectedChallenge: challengeValue,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
      credential: {
        credentialId: authenticator.credentialId,
        publicKey: authenticator.publicKey,
        counter: Number(authenticator.counter),
        transports: this.readTransports(authenticator.transports),
      },
    });

    if (!result.verified) {
      await this.logs.recordEvent(flow.companyId, {
        category: 'SECURITY',
        eventType: LOG_EVENT_TYPES['passkey.challenge_failed'],
        actorUserId: flow.userId,
        status: 'DENIED',
        ipAddress: context.ipAddress,
      });
      throw new UnauthenticatedError('The passkey could not be verified.');
    }

    await withTenantContext(client, flow.companyId, (tx) =>
      tx.authenticator.update({
        where: { id: authenticator.id },
        data: {
          counter: BigInt(result.newCounter ?? Number(authenticator.counter)),
          lastUsedAt: new Date(),
        },
      }),
    );

    await this.logs.recordEvent(flow.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['passkey.login'],
      actorUserId: flow.userId,
      resource: 'authenticator',
      resourceId: authenticator.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.auth.loginWithIdentity(flow.userId, flow.companyId, context);
  }

  async remove(companyId: string, userId: string, passkeyId: string): Promise<void> {
    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.authenticator.findFirst({
        where: { companyId, userId, id: passkeyId },
        select: { id: true },
      }),
    );
    if (!existing) {
      throw new NotFoundError('Passkey not found.');
    }

    await withTenantContext(client, companyId, (tx) =>
      tx.authenticator.delete({ where: { id: passkeyId } }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['passkey.removed'],
      actorUserId: userId,
      resource: 'authenticator',
      resourceId: passkeyId,
      status: 'SUCCESS',
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private relyingParty(): { rpId: string; rpName: string; origin: string } {
    const webauthn = this.config.webauthn;
    if (!webauthn.enabled) {
      throw new ServiceUnavailableError(
        'Passkeys are disabled. Set WEBAUTHN_ENABLED=true to enable them.',
      );
    }
    return { rpId: webauthn.rpId, rpName: webauthn.rpName, origin: webauthn.origin };
  }

  private async findActiveUser(email: string): Promise<UserLookupRow> {
    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<UserLookupRow[]>(
      Prisma.sql`SELECT "id", "companyId", "email", "status" FROM app_auth_find_user_by_email(${email.trim().toLowerCase()}::citext)`,
    );
    const user = rows[0];
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthenticatedError('No passkey is registered for this account.');
    }
    return user;
  }

  private readCredentialId(response: unknown): string | null {
    if (typeof response !== 'object' || response === null) {
      return null;
    }
    const id = (response as Record<string, unknown>)['id'];
    return typeof id === 'string' ? id : null;
  }

  /** Extracts the challenge the client signed from `clientDataJSON`. */
  private readChallenge(response: unknown): string | null {
    if (typeof response !== 'object' || response === null) {
      return null;
    }
    const inner = (response as Record<string, unknown>)['response'];
    if (typeof inner !== 'object' || inner === null) {
      return null;
    }
    const encoded = (inner as Record<string, unknown>)['clientDataJSON'];
    if (typeof encoded !== 'string') {
      return null;
    }
    try {
      const clientData = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        challenge?: unknown;
      };
      return typeof clientData.challenge === 'string' ? clientData.challenge : null;
    } catch {
      return null;
    }
  }

  private readTransports(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async storeChallenge(
    key: string,
    challenge: string,
    flow: { companyId: string; userId: string },
  ): Promise<void> {
    await this.redis
      .getClient()
      .set(
        this.challengeKey(key),
        JSON.stringify({ challenge, ...flow }),
        'EX',
        CHALLENGE_TTL_SECONDS,
      );
  }

  private async consumeChallenge(
    key: string,
  ): Promise<{ challenge: string; companyId: string; userId: string } | null> {
    const client = this.redis.getClient();
    const redisKey = this.challengeKey(key);
    const raw = await client.get(redisKey);
    if (raw === null) {
      return null;
    }
    await client.del(redisKey);
    try {
      return JSON.parse(raw) as { challenge: string; companyId: string; userId: string };
    } catch {
      return null;
    }
  }

  private challengeKey(key: string): string {
    return `passkey:challenge:${key}`;
  }
}
