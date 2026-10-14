import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { Prisma, withTenantContext } from '@hris/database';
import {
  type CurrentSession,
  type SessionInfo,
  type EffectivePermission,
  LOG_EVENT_TYPES,
  TRANSACTIONAL_EMAIL_JOB,
  type TransactionalEmailJob,
  type TransactionalEmailTemplate,
} from '@hris/shared-types';

import type { AppConfiguration } from '../../config/app-configuration';
import { APP_CONFIG } from '../../config/app-configuration.module';
import { PermissionService, type SessionPrincipal } from '../../common/auth/permission.service';
import { PasswordService } from '../../common/auth/password.service';
import { SESSION_STORE, type SessionStore } from '../../common/auth/session.store';
import {
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '../../common/errors/app-error';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.service';
import { PrismaService } from '../database/prisma.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { LogService } from '../logs/log.service';
import { MfaService } from '../mfa/mfa.service';
import { NotificationService } from '../notifications/notification.service';

interface LoginUserRow {
  id: string;
  companyId: string;
  email: string;
  displayName: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  passwordHash: string | null;
  hasVerifiedEmail: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  passwordResetExpiresAt: Date | null;
}

export interface LoginContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface LoginSuccess {
  readonly mfaRequired: false;
  readonly token: string;
  readonly expiresAt: Date;
  readonly session: CurrentSession;
}

/** Returned when the password was correct but a second factor is required. */
export interface LoginChallenge {
  readonly mfaRequired: true;
  readonly challengeToken: string;
  /** When the challenge expires; the client must restart sign-in after this. */
  readonly expiresAt: Date;
}

export type LoginResult = LoginSuccess | LoginChallenge;

const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password.';
const GENERIC_RESET_RESPONSE =
  'If an account exists for that email, a reset link has been prepared.';

/**
 * Authentication and session orchestration.
 *
 * Implementation follows ADR 0010: opaque 32-byte tokens, SHA-256 kept in Redis for
 * lookups and in sessions.token_hash as a durable record, absolute expiry, and
 * immediate revocation by deleting the Redis key. All session-record writes happen
 * inside withTenantContext so RLS applies; the single tenant-agnostic read (finding
 * the user by email at sign-in) goes through the SECURITY DEFINER function from the
 * access_admin_foundation migration.
 */
@Injectable()
export class AuthService {
  private dummyHash: string | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(RateLimiter) private readonly rateLimiter: RateLimiter,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(MfaService) private readonly mfa: MfaService,
  ) {}

  async login(email: string, password: string, context: LoginContext): Promise<LoginResult> {
    await this.enforceLoginRateLimit(context.ipAddress);

    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<LoginUserRow[]>(
      Prisma.sql`SELECT * FROM app_auth_find_user_by_email(${email.trim().toLowerCase()}::citext)`,
    );
    const user = rows[0];

    if (user === undefined) {
      await this.passwords.verifyPassword(await this.dummyHashValue(), password);
      throw new UnauthenticatedError(GENERIC_CREDENTIALS_ERROR);
    }

    if (user.lockedUntil !== null && user.lockedUntil > new Date()) {
      await this.logs.recordEvent(user.companyId, {
        category: 'SECURITY',
        eventType: LOG_EVENT_TYPES['user.login_locked'],
        actorUserId: user.id,
        status: 'DENIED',
        metadata: { reason: 'account_locked', ipAddress: context.ipAddress },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      });
      throw new UnauthenticatedError(GENERIC_CREDENTIALS_ERROR);
    }

    if (user.status !== 'ACTIVE') {
      // A suspended or disabled account must not be able to mint sessions; the
      // generic wording avoids confirming account state through the sign-in form.
      await this.logs.recordEvent(user.companyId, {
        category: 'SECURITY',
        eventType: LOG_EVENT_TYPES['user.login_locked'],
        actorUserId: user.id,
        status: 'DENIED',
        metadata: { reason: 'account_inactive', status: user.status, ipAddress: context.ipAddress },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      });
      throw new UnauthenticatedError(GENERIC_CREDENTIALS_ERROR);
    }

    const passwordOk =
      user.passwordHash !== null &&
      (await this.passwords.verifyPassword(user.passwordHash, password));

    if (!passwordOk) {
      await this.recordFailedAttempt(user, context);
      throw new UnauthenticatedError(GENERIC_CREDENTIALS_ERROR);
    }

    // A correct password is not sufficient when a second factor is enrolled: the
    // caller receives a single-use challenge instead of a session.
    if (await this.mfa.isEnrolled(user.companyId, user.id)) {
      const challengeToken = await this.mfa.createChallenge(user.companyId, user.id);
      return {
        mfaRequired: true,
        challengeToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    return this.establishSession(user.id, user.companyId, context);
  }

  /**
   * Redeems a sign-in MFA challenge and, on success, creates the session. Split
   * from {@link login} because the credential and second-factor steps are
   * separate round trips.
   */
  async verifyMfaChallenge(
    challengeToken: string,
    code: string,
    context: LoginContext,
  ): Promise<LoginSuccess> {
    const { companyId, userId } = await this.mfa.redeemChallenge(challengeToken, code);
    return this.establishSession(userId, companyId, context);
  }

  /**
   * Mints a session for a user already authenticated by an external identity
   * provider. SSO delegates the second factor to the IdP, so no MFA challenge is
   * interposed here; the caller is responsible for having validated the assertion.
   */
  async loginWithIdentity(
    userId: string,
    companyId: string,
    context: LoginContext,
  ): Promise<LoginSuccess> {
    return this.establishSession(userId, companyId, context);
  }

  /** Resets the failure counter, logs the sign-in and mints the session. */
  private async establishSession(
    userId: string,
    companyId: string,
    context: LoginContext,
  ): Promise<LoginSuccess> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.login'],
      actorUserId: userId,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    const created = await this.createSession(userId, companyId, context);
    const principal = await this.permissions.loadPrincipal(userId, companyId);
    return {
      mfaRequired: false,
      token: created.token,
      expiresAt: created.expiresAt,
      session: toCurrentSession(principal),
    };
  }

  async logout(
    tokenHash: string,
    companyId: string,
    userId: string,
    context: LoginContext,
  ): Promise<void> {
    await this.sessionStore.delete(tokenHash);

    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.session.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.logout'],
      actorUserId: userId,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  async me(principal: SessionPrincipal): Promise<CurrentSession> {
    return toCurrentSession(principal);
  }

  /** Activates an invited account: set the first password (brief: register by invitation). */
  async register(inviteToken: string, password: string, context: LoginContext): Promise<void> {
    const client = this.prisma.getClient();
    const tokenHash = this.passwords.sha256Hex(inviteToken);
    const user = await this.findUserByResetToken(tokenHash);

    if (!user) {
      throw new ValidationError(
        'This invitation link is invalid or has already been used. Please request a new one.',
      );
    }

    if (user.passwordResetExpiresAt !== null && user.passwordResetExpiresAt < new Date()) {
      throw new ValidationError('This invitation link has expired. Please request a new one.');
    }

    const passwordHash = await this.passwords.hashPassword(password);

    await withTenantContext(client, user.companyId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          status: 'ACTIVE',
          hasVerifiedEmail: true,
        },
      }),
    );

    await this.logs.writeAudit(user.companyId, {
      actorUserId: user.id,
      action: 'register',
      resource: 'user',
      resourceId: user.id,
      payload: { via: 'invitation' },
    });
    await this.logs.recordEvent(user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.email_verified'],
      actorUserId: user.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    await this.notifications.emit(user.companyId, user.id, {
      eventKey: 'user.welcome',
      userId: user.id,
      href: '/dashboard',
    });
  }

  async requestPasswordReset(email: string, context: LoginContext): Promise<string> {
    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<LoginUserRow[]>(
      Prisma.sql`SELECT * FROM app_auth_find_user_by_email(${email.trim().toLowerCase()}::citext)`,
    );
    const user = rows[0];

    // The response is identical whether or not the account exists (brief section 52).
    if (!user) {
      return GENERIC_RESET_RESPONSE;
    }

    const token = this.passwords.generateOpaqueToken();
    const tokenHash = this.passwords.sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await withTenantContext(client, user.companyId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
      }),
    );

    await this.logs.recordEvent(user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.password_reset_requested'],
      actorUserId: user.id,
      status: 'PENDING',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    await this.queueEmail({
      companyId: user.companyId,
      to: user.email,
      template: 'password-reset',
      context: { resetToken: token, expiresAt: expiresAt.toISOString() },
    });

    return GENERIC_RESET_RESPONSE;
  }

  async resetPassword(token: string, newPassword: string, context: LoginContext): Promise<void> {
    const tokenHash = this.passwords.sha256Hex(token);
    const user = await this.findUserByResetToken(tokenHash);

    if (!user) {
      throw new ValidationError(
        'This reset link is invalid or has already been used. Please request a new one.',
      );
    }
    if (user.passwordResetExpiresAt !== null && user.passwordResetExpiresAt < new Date()) {
      throw new ValidationError('This reset link has expired. Please request a new one.');
    }

    const client = this.prisma.getClient();
    const passwordHash = await this.passwords.hashPassword(newPassword);

    await withTenantContext(client, user.companyId, async (tx) => {
      const sessions = await tx.session.findMany({
        where: { userId: user.id, revokedAt: null, deletedAt: null },
        select: { tokenHash: true },
      });
      for (const session of sessions) {
        await this.sessionStore.delete(session.tokenHash);
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        // All sessions are invalidated on a password reset; each Redis key has been
        // deleted so the new password cannot race an old session.
        data: { revokedAt: new Date() },
      });
    });

    await this.logs.recordEvent(user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.password_reset'],
      actorUserId: user.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    await this.notifications.emit(user.companyId, user.id, {
      eventKey: 'user.password_changed',
      userId: user.id,
      href: '/settings/security',
    });
  }

  async changePassword(
    principal: SessionPrincipal,
    currentPassword: string,
    newPassword: string,
    context: LoginContext,
  ): Promise<void> {
    const client = this.prisma.getClient();

    // The current password is verified against the live hash (found across tenants;
    // the principal's email is the identifier on the account being changed).
    const rows = await client.$queryRaw<LoginUserRow[]>(
      Prisma.sql`SELECT * FROM app_auth_find_user_by_email(${principal.user.email}::citext)`,
    );
    const current = rows[0];
    const verified =
      current !== undefined &&
      current.passwordHash !== null &&
      (await this.passwords.verifyPassword(current.passwordHash, currentPassword));

    if (!verified) {
      throw new UnauthenticatedError('Invalid email or password.');
    }

    const passwordHash = await this.passwords.hashPassword(newPassword);
    const companyId = principal.user.companyId;

    await withTenantContext(client, companyId, (tx) =>
      tx.user.update({
        where: { id: principal.user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.password_changed'],
      actorUserId: principal.user.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    await this.notifications.emit(companyId, principal.user.id, {
      eventKey: 'user.password_changed',
      userId: principal.user.id,
      href: '/settings/security',
    });
  }

  async verifyEmail(token: string, context: LoginContext): Promise<void> {
    const tokenHash = this.passwords.sha256Hex(token);
    const client = this.prisma.getClient();

    // Locate the user across tenants via the SECURITY DEFINER lookup extended with the
    // verification hash by re-reading the live row through the function keyed on email
    // is not possible (the function does not expose the hash), so verification reads by
    // token hash through a tenant-agnostic helper below.
    const user = await this.findUserByVerificationToken(tokenHash, client);
    if (!user) {
      throw new ValidationError('This verification link is invalid or has already been used.');
    }

    await withTenantContext(client, user.companyId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { hasVerifiedEmail: true, emailVerificationTokenHash: null },
      }),
    );

    await this.logs.recordEvent(user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.email_verified'],
      actorUserId: user.id,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  async listSessions(
    principal: SessionPrincipal,
    currentSessionId: string,
  ): Promise<SessionInfo[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, principal.user.companyId, (tx) =>
      tx.session.findMany({
        where: { userId: principal.user.id, revokedAt: null, deletedAt: null },
        orderBy: [{ lastSeenAt: 'desc' }],
        select: {
          id: true,
          userId: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      isCurrent: row.id === currentSessionId,
    }));
  }

  /** Revokes one of the caller's sessions, revoking the current one too if asked. */
  async revokeSession(
    principal: SessionPrincipal,
    sessionId: string,
    context: LoginContext,
  ): Promise<void> {
    const client = this.prisma.getClient();
    const target = await withTenantContext(client, principal.user.companyId, (tx) =>
      tx.session.findFirst({
        where: { id: sessionId, userId: principal.user.id, revokedAt: null, deletedAt: null },
        select: { tokenHash: true },
      }),
    );
    if (!target) {
      throw new ValidationError('This session does not exist or has already been revoked.');
    }

    await this.sessionStore.delete(target.tokenHash);
    await withTenantContext(client, principal.user.companyId, (tx) =>
      tx.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }),
    );

    await this.logs.recordEvent(principal.user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.session_revoked'],
      actorUserId: principal.user.id,
      resource: 'session',
      resourceId: sessionId,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  /** Revokes every session of the caller except the one that issued the request. */
  async revokeOtherSessions(
    principal: SessionPrincipal,
    currentSessionId: string,
    context: LoginContext,
  ): Promise<void> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, principal.user.companyId, (tx) =>
      tx.session.findMany({
        where: {
          userId: principal.user.id,
          id: { not: currentSessionId },
          revokedAt: null,
          deletedAt: null,
        },
        select: { id: true, tokenHash: true },
      }),
    );

    for (const row of rows) {
      await this.sessionStore.delete(row.tokenHash);
    }
    await withTenantContext(client, principal.user.companyId, (tx) =>
      tx.session.updateMany({
        where: {
          userId: principal.user.id,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    );

    await this.logs.recordEvent(principal.user.companyId, {
      category: 'AUTHENTICATION',
      eventType: LOG_EVENT_TYPES['user.session_revoked_all'],
      actorUserId: principal.user.id,
      status: 'SUCCESS',
      metadata: { affected: rows.length },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  private async findUserByResetToken(tokenHash: string): Promise<LoginUserRow | null> {
    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<LoginUserRow[]>(
      Prisma.sql`SELECT * FROM app_auth_find_user_by_reset_token(${tokenHash})`,
    );
    return rows[0] ?? null;
  }

  private async findUserByVerificationToken(
    tokenHash: string,
    client: ReturnType<PrismaService['getClient']>,
  ): Promise<LoginUserRow | null> {
    const rows = await client.$queryRaw<LoginUserRow[]>(
      Prisma.sql`SELECT * FROM app_auth_find_user_by_verification_token(${tokenHash})`,
    );
    return rows[0] ?? null;
  }

  private async recordFailedAttempt(user: LoginUserRow, context: LoginContext): Promise<void> {
    const client = this.prisma.getClient();
    const nextAttempts = user.failedAttempts + 1;
    const shouldLock = nextAttempts >= this.config.auth.maxFailedAttempts;
    const lockUntil = shouldLock
      ? new Date(Date.now() + this.config.auth.lockoutSeconds * 1000)
      : null;

    await withTenantContext(client, user.companyId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { failedAttempts: shouldLock ? 0 : nextAttempts, lockedUntil: lockUntil },
      }),
    );

    await this.logs.recordEvent(user.companyId, {
      category: shouldLock ? 'SECURITY' : 'AUTHENTICATION',
      eventType: shouldLock
        ? LOG_EVENT_TYPES['security.lockout']
        : LOG_EVENT_TYPES['user.login_failed'],
      actorUserId: user.id,
      status: shouldLock ? 'LOCKED' : 'FAILED',
      metadata: { reason: 'invalid_credentials' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  private async enforceLoginRateLimit(ipAddress?: string): Promise<void> {
    const key = `hris:rl:login:${this.passwords.sha256Hex(ipAddress ?? 'unknown')}`;
    const result = await this.rateLimiter.consume(
      key,
      this.config.auth.loginRateLimitPerMinute,
      60,
    );
    if (!result.allowed) {
      throw new RateLimitedError(
        'Too many sign-in attempts. Please wait a minute and try again.',
        result.retryAfterSeconds,
      );
    }
  }

  private async createSession(
    userId: string,
    companyId: string,
    context: LoginContext,
  ): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = this.passwords.generateOpaqueToken();
    const tokenHash = this.passwords.sha256Hex(token);
    const expiresAt = new Date(Date.now() + this.config.auth.sessionTtlSeconds * 1000);

    const client = this.prisma.getClient();
    const session = await withTenantContext(client, companyId, (tx) =>
      tx.session.create({
        data: {
          userId,
          companyId,
          tokenHash,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          expiresAt,
          createdBy: userId,
        },
        select: { id: true },
      }),
    );

    await this.sessionStore.create(
      tokenHash,
      { sessionId: session.id, userId, companyId, expiresAt: expiresAt.toISOString() },
      this.config.auth.sessionTtlSeconds,
    );

    return { token, sessionId: session.id, expiresAt };
  }

  async getDummyHash(): Promise<string> {
    return this.dummyHashValue();
  }

  private async dummyHashValue(): Promise<string> {
    this.dummyHash ??= await this.passwords.hashPassword(randomUUID());
    return this.dummyHash;
  }

  private async queueEmail(input: {
    companyId: string;
    to: string;
    template: TransactionalEmailTemplate;
    context: Readonly<Record<string, string>>;
  }): Promise<void> {
    if (!this.queue.isConfigured) {
      return;
    }
    await this.queue
      .getQueue(QUEUE_NAMES.NOTIFICATIONS)
      .add(TRANSACTIONAL_EMAIL_JOB, input satisfies TransactionalEmailJob);
  }
}

function toCurrentSession(principal: SessionPrincipal): CurrentSession {
  return {
    user: {
      id: principal.user.id,
      companyId: principal.user.companyId,
      email: principal.user.email,
      displayName: principal.user.displayName,
      status: principal.user.status,
      hasVerifiedEmail: principal.user.hasVerifiedEmail,
      lastLoginAt: principal.user.lastLoginAt?.toISOString() ?? null,
      roles: principal.roles,
    },
    permissions: principal.permissions.map((permission): EffectivePermission => ({
      resource: permission.resource,
      action: permission.action,
      scope: permission.scope,
    })),
  };
}
