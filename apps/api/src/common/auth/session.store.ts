import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../modules/redis/redis.service';

/**
 * The session-cache contract.
 *
 * ADR 0010 requires the session store to sit behind an interface so reverting to
 * stateless tokens remains a configuration-level change. Redis is the only
 * implementation today; it is also the design's fast path, and a miss is an
 * unauthenticated request, full stop.
 */
export const SESSION_STORE = Symbol('SESSION_STORE');

export interface StoredSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly companyId: string;
  readonly expiresAt: string;
}

export interface SessionStore {
  create(tokenHash: string, session: StoredSession, ttlSeconds: number): Promise<void>;
  read(tokenHash: string): Promise<StoredSession | null>;
  delete(tokenHash: string): Promise<void>;
}

export class SessionStoreError extends Error {}

@Injectable()
export class RedisSessionStore implements SessionStore {
  private static readonly KEY_PREFIX = 'hris:session:';

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async create(tokenHash: string, session: StoredSession, ttlSeconds: number): Promise<void> {
    const client = this.redis.getClient();
    const key = this.keyFor(tokenHash);

    const result = await client.set(key, JSON.stringify(session), 'EX', ttlSeconds, 'NX');
    if (result !== 'OK') {
      // A hash collision on a 256-bit value is not a realistic event, but the store is
      // an orphaned-token source of truth: refusing to overwrite an existing key keeps
      // Redis and the sessions row from disagreeing about who owns that hash.
      throw new SessionStoreError('A session with this token hash already exists');
    }
  }

  async read(tokenHash: string): Promise<StoredSession | null> {
    const client = this.redis.getClient();
    const raw = await client.get(this.keyFor(tokenHash));
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (
        typeof parsed.sessionId !== 'string' ||
        typeof parsed.userId !== 'string' ||
        typeof parsed.companyId !== 'string' ||
        typeof parsed.expiresAt !== 'string'
      ) {
        return null;
      }
      return parsed as StoredSession;
    } catch {
      // A malformed value is a defect, but treating it as a missing session fails
      // closed rather than logging the user in on a structure we cannot reason about.
      return null;
    }
  }

  async delete(tokenHash: string): Promise<void> {
    await this.redis.getClient().del(this.keyFor(tokenHash));
  }

  private keyFor(tokenHash: string): string {
    return `${RedisSessionStore.KEY_PREFIX}${tokenHash}`;
  }
}
