import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { RedisService } from '../../redis/redis.service';

/**
 * Redis readiness.
 *
 * `PING` is used rather than a read or a write because it proves the connection is
 * authenticated and the server is responsive, while leaving the dataset alone. A
 * readiness probe must be side-effect free: writing a probe key to a Redis configured
 * with `maxmemory-policy noeviction` can fail, and then a full Redis would report
 * itself unhealthy for a reason that is the probe's fault.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redis.isConfigured) {
      return this.getStatus(key, false, { message: 'Redis is not configured (REDIS_PASSWORD)' });
    }

    try {
      const startedAt = process.hrtime.bigint();
      const response = await this.redis.getClient().ping();
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      // A server that is reachable but not answering PONG with PONG is in a state where
      // commands cannot be trusted, so it is treated as unhealthy rather than reported
      // as healthy with a surprise value.
      if (response !== 'PONG') {
        return this.getStatus(key, false, { message: `unexpected PING reply "${response}"` });
      }

      return this.getStatus(key, true, { latencyMs: Math.round(latencyMs * 100) / 100 });
    } catch (error: unknown) {
      return this.getStatus(key, false, { message: describeRedisError(error) });
    }
  }
}

/**
 * Maps ioredis error text onto an actionable hint.
 *
 * ioredis does not attach a stable `code` to every failure, so the message is the only
 * thing available. An empty Redis password is worth calling out specifically: the server
 * accepts the connection and rejects every command, which otherwise looks like a
 * network problem.
 */
function describeRedisError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown error';
  }

  if (/NOAUTH|WRONGPASS|AUTH/i.test(error.message)) {
    return 'authentication failed (check REDIS_PASSWORD)';
  }

  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(error.message)) {
    return 'connection failed (is Redis running, and are REDIS_HOST/REDIS_PORT correct?)';
  }

  return error.message;
}
