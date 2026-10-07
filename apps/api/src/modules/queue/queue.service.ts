import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import { buildBullMqConnectionOptions } from '../redis/redis.service';

/**
 * Background queues (M00 foundation).
 *
 * Names live here rather than inline at each call site because a queue is a durable
 * contract: renaming one strands the jobs already persisted in it, and a typo in a
 * string literal silently creates a queue that no worker ever reads.
 *
 * Phase 1 registers no queues. Each module declares its own when it needs one, so this
 * list grows with the system rather than being a speculative guess at M01-M09.
 */
export const QUEUE_NAMES = {
  /** Outbound email and other provider calls that must not block a request. */
  NOTIFICATIONS: 'hris.notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Defaults applied to every job unless the caller overrides them.
 *
 * `removeOnComplete` keeps the queue from growing without bound, which matters more than
 * usual here because Redis is capped by `maxmemory-policy noeviction`: once the cap is
 * reached, writes fail rather than evicting, so unbounded retention would take the whole
 * job system down rather than just the oldest jobs.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/**
 * Creates BullMQ queues on demand and closes them on shutdown.
 *
 * Queues are created lazily so an API instance that runs no workers — the common case,
 * since workers are scaled separately — holds no BullMQ resources at all.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  get isConfigured(): boolean {
    return this.config.redis !== null;
  }

  /**
   * The queue with this name, creating it on first request.
   *
   * Returns the same instance for a given name so repeated calls share one connection
   * instead of opening a new one per request.
   */
  getQueue(name: QueueName): Queue {
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: buildBullMqConnectionOptions(this.config),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.queues.set(name, queue);
    return queue;
  }

  async onModuleDestroy(): Promise<void> {
    // Closing in parallel: `close()` waits for in-flight commands, so doing them one at
    // a time makes shutdown time the sum of every queue instead of the slowest one.
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}
