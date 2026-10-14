import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../modules/redis/redis.service';

export interface RateLimitResult {
  /** Whether the caller may proceed with the request. */
  readonly allowed: boolean;
  /** The configured ceiling for the window. */
  readonly limit: number;
  /** Requests still available in the current window. */
  readonly remaining: number;
  /** Seconds until the window resets; zero when the request was allowed. */
  readonly retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis.
 *
 * The counter is per key (`principal`, IP, client id, ...) and the first write in a
 * window sets the expiry, so a burst cannot extend the window indefinitely. Redis is
 * already a hard dependency of authentication (sessions live there), so this introduces
 * no new failure mode: if Redis is unreachable the caller is failing authentication
 * anyway. Counters are opaque keys, never request bodies, so no payload or credential is
 * written to Redis.
 */
@Injectable()
export class RateLimiter {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /**
   * Consumes one unit for `key`. The window is created on first use and expires
   * `windowSeconds` later; subsequent calls in the same window only increment.
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const client = this.redis.getClient();
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }

    // A key with no TTL (a crash between INCR and EXPIRE) must not persist forever.
    let ttl = await client.ttl(key);
    if (ttl < 0) {
      await client.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    const allowed = current <= limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - current),
      retryAfterSeconds: allowed ? 0 : Math.max(1, ttl),
    };
  }
}
