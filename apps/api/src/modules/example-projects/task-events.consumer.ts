import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus.service';
import type { DomainEvent } from '../events/domain-event.types';
import { LogService } from '../logs/log.service';

/**
 * Reacts to the example domain's events.
 *
 * This is the "consumer" half of the extension demonstration: it subscribes to
 * `task.completed` and records an operational log event. Because it is a subscriber of
 * the generic bus, nothing in core references it, and the side effect is observable in
 * the same request that ran the action.
 */
@Injectable()
export class TaskEventsConsumer implements OnModuleInit {
  constructor(
    @Inject(DomainEventBus) private readonly bus: DomainEventBus,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<Record<string, unknown>>('task.completed', (event) =>
      this.onTaskCompleted(event),
    );
  }

  private async onTaskCompleted(event: DomainEvent): Promise<void> {
    await this.logs.recordEvent(event.companyId, {
      category: 'ACTIVITY',
      eventType: 'task.completed',
      actorUserId: event.actorUserId ?? undefined,
      resource: 'task',
      resourceId: event.resourceId,
      status: 'SUCCESS',
      metadata: event.payload,
    });
  }
}
