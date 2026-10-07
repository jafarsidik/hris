import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';

/**
 * Owns the Redis connections used for sessions and queues.
 *
 * Lazy for the same reason as {@link PrismaService}: a deployment missing Redis
 * credentials must still boot and report unhealthy through readiness rather than
 * crash-loop.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private connection: Redis | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  get isConfigured(): boolean {
    return this.config.redis !== null;
  }

  /**
   * The shared connection.
   *
   * `lazyConnect` is deliberately not set, because the first command should be the one
   * that reveals an unreachable Redis, not a background connect that fails silently
   * while the connection object still looks usable.
   */
  getClient(): Redis {
    if (!this.config.redis) {
      throw new Error(
        'Redis is not configured. Set REDIS_PASSWORD (see .env.example); Redis runs with ' +
          'requirepass, so an unauthenticated instance is not a supported configuration.',
      );
    }

    this.connection ??= new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      ...(this.config.redis.password === null ? {} : { password: this.config.redis.password }),
      db: this.config.redis.db,
      // Reconnect with an exponential backoff rather than a tight loop, so an outage
      // does not turn every command into a flood against an already-struggling server.
      retryStrategy: (attempt: number) => Math.min(attempt * 200, 5000),
      maxRetriesPerRequest: null,
    });

    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }
}

/**
 * Connection options for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null`, which is incompatible with an ioredis
 * instance that already has a value set, so the worker is given these options rather
 * than the shared connection object. Reusing the shared connection would also let a
 * blocked queue command stall session traffic on the same socket.
 */
export function buildBullMqConnectionOptions(config: AppConfiguration): RedisOptions {
  if (!config.redis) {
    throw new Error('Redis is not configured; the queue cannot be created.');
  }

  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password ?? undefined,
    db: config.redis.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
