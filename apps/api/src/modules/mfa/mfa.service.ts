import { randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { toDataURL } from 'qrcode';

import { withTenantContext } from '@hris/database';
import { LOG_EVENT_TYPES } from '@hris/shared-types';

import { PasswordService } from '../../common/auth/password.service';
import { CredentialCipherService } from '../../common/crypto/credential-cipher.service';
import { generateTotpSecret, totpUri, verifyTotp } from '../../common/crypto/totp';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthenticatedError,
  ValidationError,
} from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { RedisService } from '../redis/redis.service';

export interface MfaStatus {
  readonly enrolled: boolean;
  readonly confirmedAt: string | null;
  readonly recoveryCodesRemaining: number;
}

export interface MfaEnrollment {
  /** The unconfirmed factor awaiting a first valid code. */
  readonly factorId: string;
  /** Shown once; the only time the plaintext secret leaves the server. */
  readonly secret: string;
  readonly otpauthUrl: string;
  /** A data: URL the client renders directly; avoids shipping a QR library. */
  readonly qrDataUrl: string;
}

export interface MfaRecoveryCodes {
  readonly codes: readonly string[];
}

const RECOVERY_CODE_COUNT = 10;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const TOTP_ISSUER = 'HRIS';

/**
 * Multi-factor authentication (System -> Security).
 *
 * TOTP secrets are AES-256-GCM encrypted with the MFA key before they touch the
 * database. Recovery codes are stored only as SHA-256 hashes and are consumed on
 * use. A sign-in challenge is a short-lived, single-use Redis token so a stolen
 * password cannot be replayed against the second factor.
 */
@Injectable()
export class MfaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(CredentialCipherService) private readonly cipher: CredentialCipherService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async getStatus(companyId: string, userId: string): Promise<MfaStatus> {
    const client = this.prisma.getClient();
    const [factor, remaining] = await withTenantContext(client, companyId, async (tx) =>
      Promise.all([
        tx.mfaFactor.findFirst({
          where: { companyId, userId, confirmedAt: { not: null } },
          select: { confirmedAt: true },
          orderBy: { confirmedAt: 'asc' },
        }),
        tx.mfaRecoveryCode.count({ where: { companyId, userId, usedAt: null } }),
      ]),
    );

    return {
      enrolled: factor !== null,
      confirmedAt: factor?.confirmedAt?.toISOString() ?? null,
      recoveryCodesRemaining: remaining,
    };
  }

  /** Whether the user must satisfy a second factor at sign-in. */
  async isEnrolled(companyId: string, userId: string): Promise<boolean> {
    const client = this.prisma.getClient();
    const factor = await withTenantContext(client, companyId, (tx) =>
      tx.mfaFactor.findFirst({
        where: { companyId, userId, confirmedAt: { not: null } },
        select: { id: true },
      }),
    );
    return factor !== null;
  }

  /**
   * Starts enrollment. Refuses when a confirmed factor already exists so a user
   * cannot accumulate live secrets by refreshing the setup page.
   */
  async beginEnrollment(
    companyId: string,
    userId: string,
    email: string,
    label: string,
  ): Promise<MfaEnrollment> {
    if (!this.cipher.isConfigured('mfa')) {
      throw new ServiceUnavailableError(
        'MFA is not available because the encryption key is not configured.',
      );
    }

    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.mfaFactor.findFirst({
        where: { companyId, userId, confirmedAt: { not: null } },
        select: { id: true },
      }),
    );
    if (existing) {
      throw new ConflictError('Multi-factor authentication is already enabled for this account.');
    }

    const secret = generateTotpSecret();
    const encrypted = this.cipher.encrypt('mfa', secret);

    const factor = await withTenantContext(client, companyId, (tx) =>
      tx.mfaFactor.create({
        data: {
          companyId,
          userId,
          type: 'TOTP',
          secretEncrypted: encrypted,
          label,
          createdBy: userId,
        },
        select: { id: true },
      }),
    );

    const otpauthUrl = totpUri({ issuer: TOTP_ISSUER, label: email, secret });
    const qrDataUrl = await toDataURL(otpauthUrl);

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['mfa.enrollment_started'],
      actorUserId: userId,
      resource: 'mfa-factor',
      resourceId: factor.id,
      status: 'PENDING',
    });

    return { factorId: factor.id, secret, otpauthUrl, qrDataUrl };
  }

  /**
   * Confirms enrollment with the first valid code and returns the recovery codes,
   * which are shown exactly once.
   */
  async confirmEnrollment(
    companyId: string,
    userId: string,
    factorId: string,
    code: string,
  ): Promise<MfaRecoveryCodes> {
    const client = this.prisma.getClient();
    const factor = await withTenantContext(client, companyId, (tx) =>
      tx.mfaFactor.findFirst({
        where: { companyId, userId, id: factorId },
        select: { id: true, secretEncrypted: true, confirmedAt: true },
      }),
    );
    if (!factor) {
      throw new NotFoundError('That enrollment does not exist.');
    }
    if (factor.confirmedAt !== null) {
      throw new ConflictError('That factor is already confirmed.');
    }

    const secret = this.cipher.decrypt('mfa', factor.secretEncrypted);
    if (!verifyTotp(secret, code)) {
      await this.logs.recordEvent(companyId, {
        category: 'SECURITY',
        eventType: LOG_EVENT_TYPES['mfa.challenge_failed'],
        actorUserId: userId,
        resource: 'mfa-factor',
        resourceId: factorId,
        status: 'FAILED',
      });
      throw new UnauthenticatedError('That code is not valid. Check your authenticator and retry.');
    }

    const codes = generateRecoveryCodes();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.mfaFactor.update({
        where: { id: factorId },
        data: { confirmedAt: new Date(), lastUsedAt: new Date() },
      });
      await tx.mfaRecoveryCode.updateMany({
        where: { companyId, userId, usedAt: null },
        data: { deletedAt: new Date() },
      });
      for (const plain of codes) {
        await tx.mfaRecoveryCode.create({
          data: { companyId, userId, codeHash: this.passwords.sha256Hex(plain), createdBy: userId },
        });
      }
    });

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['mfa.enrolled'],
      actorUserId: userId,
      resource: 'mfa-factor',
      resourceId: factorId,
      status: 'SUCCESS',
    });

    return { codes };
  }

  /** Disables every factor and recovery code for the user. */
  async disable(companyId: string, userId: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.mfaFactor.updateMany({
        where: { companyId, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.mfaRecoveryCode.updateMany({
        where: { companyId, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['mfa.disabled'],
      actorUserId: userId,
      resource: 'mfa-factor',
      status: 'SUCCESS',
    });
  }

  /** Issues (or re-issues) the recovery code set for an enrolled user. */
  async regenerateRecoveryCodes(companyId: string, userId: string): Promise<MfaRecoveryCodes> {
    if (!(await this.isEnrolled(companyId, userId))) {
      throw new ValidationError(
        'Enable multi-factor authentication before generating recovery codes.',
      );
    }
    const codes = generateRecoveryCodes();
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await tx.mfaRecoveryCode.updateMany({
        where: { companyId, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      for (const plain of codes) {
        await tx.mfaRecoveryCode.create({
          data: { companyId, userId, codeHash: this.passwords.sha256Hex(plain), createdBy: userId },
        });
      }
    });
    return { codes };
  }

  // ---------------------------------------------------------------------------
  // Sign-in challenge
  // ---------------------------------------------------------------------------

  /** Stores a single-use challenge and returns the opaque token for the client. */
  async createChallenge(companyId: string, userId: string): Promise<string> {
    const token = this.passwords.generateOpaqueToken();
    const key = challengeKey(this.passwords.sha256Hex(token));
    await this.redis
      .getClient()
      .set(key, JSON.stringify({ companyId, userId }), 'EX', CHALLENGE_TTL_SECONDS);
    return token;
  }

  /**
   * Redeems a challenge token with a TOTP code or a recovery code. The token is
   * deleted on the first attempt so a wrong code cannot be brute-forced against
   * the same challenge.
   */
  async redeemChallenge(
    challengeToken: string,
    code: string,
  ): Promise<{ readonly companyId: string; readonly userId: string }> {
    const client = this.redis.getClient();
    const key = challengeKey(this.passwords.sha256Hex(challengeToken));
    const raw = await client.get(key);
    if (raw === null) {
      throw new UnauthenticatedError('This sign-in challenge has expired. Please sign in again.');
    }
    await client.del(key);

    const { companyId, userId } = JSON.parse(raw) as { companyId: string; userId: string };
    const accepted = await this.verifyCode(companyId, userId, code);
    if (!accepted) {
      await this.logs.recordEvent(companyId, {
        category: 'SECURITY',
        eventType: LOG_EVENT_TYPES['mfa.challenge_failed'],
        actorUserId: userId,
        status: 'FAILED',
      });
      throw new UnauthenticatedError('That code is not valid. Please try again.');
    }

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['mfa.challenge_passed'],
      actorUserId: userId,
      status: 'SUCCESS',
    });

    return { companyId, userId };
  }

  /** Accepts a current/adjacent TOTP code or an unused recovery code. */
  private async verifyCode(companyId: string, userId: string, code: string): Promise<boolean> {
    const client = this.prisma.getClient();
    const factors = await withTenantContext(client, companyId, (tx) =>
      tx.mfaFactor.findMany({
        where: { companyId, userId, confirmedAt: { not: null } },
        select: { id: true, secretEncrypted: true },
      }),
    );

    for (const factor of factors) {
      const secret = this.cipher.decrypt('mfa', factor.secretEncrypted);
      // One step of tolerance either side absorbs clock skew without widening the
      // window enough to make replay practical.
      if (verifyTotp(secret, code, { window: 1 })) {
        await withTenantContext(client, companyId, (tx) =>
          tx.mfaFactor.update({ where: { id: factor.id }, data: { lastUsedAt: new Date() } }),
        );
        return true;
      }
    }

    const normalized = code.trim().toUpperCase();
    const hash = this.passwords.sha256Hex(normalized);
    return withTenantContext(client, companyId, async (tx) => {
      const recovery = await tx.mfaRecoveryCode.findFirst({
        where: { companyId, userId, codeHash: hash, usedAt: null },
        select: { id: true },
      });
      if (!recovery) {
        return false;
      }
      await tx.mfaRecoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() },
      });
      return true;
    });
  }
}

function challengeKey(tokenHash: string): string {
  return `hris:mfa:challenge:${tokenHash}`;
}

/** Ten human-transcribable codes, e.g. `4F2A9-1C7BE`. */
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  while (codes.length < RECOVERY_CODE_COUNT) {
    const bytes = Array.from({ length: 10 }, () => randomInt(0, 16).toString(16)).join('');
    if (!codes.includes(bytes)) {
      codes.push(bytes.toUpperCase());
    }
  }
  return codes;
}
