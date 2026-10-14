import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Credential and token primitives.
 *
 * The password hash is argon2id, the OWASP-retired-scrypt successor, so a leaked
 * password_hash table is not immediately surrendereble as cleartext credentials.
 * The opaque session token is 32 random bytes base64url-encoded (ADR 0010) and is
 * never stored: only its SHA-256 is kept, in Redis for lookups and in sessions.token_hash
 * as a durable record.
 */
@Injectable()
export class PasswordService {
  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  /** Never throws: a malformed stored hash is refused as a mismatch. */
  async verifyPassword(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(storedHash, plain);
    } catch {
      return false;
    }
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  sha256Hex(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /** Constant-time comparison for token hashes. */
  constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
