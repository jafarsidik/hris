import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { QueueService } from '../../queue/queue.service';
import { QUEUE_NAMES } from '../../queue/queue.service';

/**
 * Queue readiness.
 *
 * Separate from the Redis indicator even though both talk to Redis, because they answer
 * different questions. Redis being reachable does not mean BullMQ can use it: a queue
 * also depends on the connection options BullMQ requires (`maxRetriesPerRequest: null`,
 * `enableReadyCheck: false`) which are not the ones a plain `PING` uses.
 *
 * Only one queue is opened. Creating every queue to check them all would connect to
 * Redis on every readiness poll, which is a lot of traffic for a probe that runs every
 * few seconds.
 */
@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(@Inject(QueueService) private readonly queues: QueueService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.queues.isConfigured) {
      return this.getStatus(key, false, { message: 'queue is not configured (REDIS_PASSWORD)' });
    }

    try {
      const queue = this.queues.getQueue(QUEUE_NAMES.NOTIFICATIONS);
      // `waitUntilReady` resolves once BullMQ's own connection is established, which is
      // the part a bare Redis PING cannot observe.
      const client = await queue.waitUntilReady();
      const connection = client as { options?: { host?: string; port?: number } };

      return this.getStatus(key, true, {
        queue: QUEUE_NAMES.NOTIFICATIONS,
        host: connection.options?.host,
        port: connection.options?.port,
      });
    } catch (error: unknown) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
