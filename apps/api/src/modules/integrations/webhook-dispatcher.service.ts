import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import {
  WEBHOOK_DELIVERY_JOB,
  WEBHOOK_WILDCARD,
  type WebhookDeliveryJob,
} from '@hris/shared-types';

import { DomainEventBus } from '../events/domain-event-bus.service';
import type { DomainEvent } from '../events/domain-event.types';
import { PrismaService } from '../database/prisma.service';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service';
import { readUrl } from './webhook.adapter';

/**
 * Fans every domain event out to the tenant's subscribed webhook endpoints.
 *
 * The dispatcher is a generic consumer of the event bus rather than a collaborator of
 * any producer: it registers once for all events and decides per tenant which endpoints
 * care. It only enqueues; the worker owns delivery, signing and retries, so a slow or
 * failing endpoint never delays the request that produced the event.
 *
 * The lookup and the enqueue happen in the same call, but a failure to enqueue is a
 * logged miss rather than a thrown error: the triggering action has already committed,
 * and the bus isolates consumers so one failing endpoint cannot deny the others.
 */
@Injectable()
export class WebhookDispatcher implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    @Inject(DomainEventBus) private readonly bus: DomainEventBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queues: QueueService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribeAll<Record<string, unknown>>((event) => this.dispatch(event));
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    if (!this.queues.isConfigured) {
      return;
    }

    const targets = await this.findTargets(event);
    if (targets.length === 0) {
      return;
    }

    const queue = this.queues.getQueue(QUEUE_NAMES.WEBHOOKS);
    await Promise.all(
      targets.map((integrationId) =>
        queue.add(
          WEBHOOK_DELIVERY_JOB,
          {
            companyId: event.companyId,
            integrationId,
            event: {
              // Stable across retries so a receiver can de-duplicate.
              id: `${event.resourceId}:${event.type}:${event.occurredAt.getTime()}:${integrationId}`,
              type: event.type,
              companyId: event.companyId,
              resource: event.resource,
              resourceId: event.resourceId,
              actorUserId: event.actorUserId,
              occurredAt: event.occurredAt.toISOString(),
              data: event.payload,
            },
          } satisfies WebhookDeliveryJob,
          // Deterministic per event and endpoint, so a retry of the same domain event
          // collapses onto the in-flight job instead of enqueueing a duplicate delivery.
          {
            jobId: `${event.type}-${event.resourceId}-${event.occurredAt.getTime()}-${integrationId}`,
          },
        ),
      ),
    );
  }

  /**
   * The enabled webhook integrations whose active subscriptions match the event.
   *
   * A missing or invalid endpoint URL is skipped here rather than enqueued for a
   * guaranteed failed delivery.
   */
  private async findTargets(event: DomainEvent): Promise<readonly string[]> {
    try {
      const client = this.prisma.getClient();
      return await withTenantContext(client, event.companyId, async (tx) => {
        const rows = await tx.integration.findMany({
          where: {
            kind: 'WEBHOOK',
            isEnabled: true,
            subscriptions: {
              some: { isActive: true, eventType: { in: [event.type, WEBHOOK_WILDCARD] } },
            },
          },
          select: { id: true, config: true },
        });
        return rows
          .filter((row) => readUrl((row.config ?? {}) as Record<string, unknown>) !== null)
          .map((row) => row.id);
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Webhook fan-out skipped for "${event.type}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }
}
