import { Inject, Injectable, Logger } from '@nestjs/common';

import type { DomainEvent, DomainEventHandler } from './domain-event.types';
import { OutboxService } from './outbox.service';

/**
 * Durable publish/subscribe for domain events.
 *
 * Consumers register a handler for an event name at module start-up; producers call
 * {@link emit} after their state change commits. Every event is written to the outbox
 * *before* any consumer runs, so the fact survives a consumer that throws or a process
 * that dies mid-fan-out. Dispatch is awaited and every consumer is isolated: one
 * subscriber throwing is logged and does not stop the others or fail the producer,
 * because a misbehaving listener must not roll back an action that already succeeded.
 *
 * The delivery outcome is written back to the outbox row: it is marked published only
 * when every consumer has run cleanly, so a row still awaiting a delivery is exactly the
 * set an operator can retry from the Event Registry. Retrying re-runs the consumers for
 * that one event without writing a second row, which is why consumers must be
 * idempotent — the platform guarantees at-least-once, not exactly-once.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, DomainEventHandler[]>();
  private readonly allSubscribers: DomainEventHandler[] = [];

  constructor(@Inject(OutboxService) private readonly outbox: OutboxService) {}

  /** Registers a consumer for an event type. Multiple consumers per type are allowed. */
  subscribe<TPayload>(type: string, handler: DomainEventHandler<TPayload>): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(type, existing);
  }

  /**
   * Registers a consumer for every event type.
   *
   * This is the extension point for a generic fan-out (the webhook dispatcher, the
   * business-rule engine) that must see events whose names it cannot know at load time.
   * It is deliberately separate from {@link subscribe} so a typed consumer still
   * registers against one name.
   */
  subscribeAll<TPayload>(handler: DomainEventHandler<TPayload>): void {
    this.allSubscribers.push(handler as DomainEventHandler);
  }

  /** True when at least one consumer is registered (used by tests and diagnostics). */
  hasSubscribers(type: string): boolean {
    return (this.handlers.get(type) ?? []).length > 0 || this.allSubscribers.length > 0;
  }

  /** Persists the fact, then delivers it to every subscriber. */
  async emit<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    let outboxId: string | null = null;
    try {
      outboxId = await this.outbox.record(event as DomainEvent);
    } catch (error: unknown) {
      // The producer's change has already committed. Losing the durable copy is a
      // serious fault worth a loud log, but it must not turn a successful action into a
      // 500 for the caller.
      this.logger.error(
        `Failed to persist domain event "${event.type}" to the outbox`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.deliver(event as DomainEvent, outboxId);
  }

  /** Re-delivers an already-persisted event (used by the registry's retry path). */
  async redeliver(event: DomainEvent, outboxId: string): Promise<void> {
    await this.deliver(event, outboxId);
  }

  private async deliver(event: DomainEvent, outboxId: string | null): Promise<void> {
    const subscribers = [...(this.handlers.get(event.type) ?? []), ...this.allSubscribers];
    let lastFailure: string | undefined;

    for (const handler of subscribers) {
      try {
        await handler(event as DomainEvent);
      } catch (error: unknown) {
        lastFailure = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Domain event consumer failed for "${event.type}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (outboxId === null) {
      return;
    }

    try {
      if (lastFailure === undefined) {
        await this.outbox.markPublished(outboxId, event.companyId);
      } else {
        await this.outbox.markFailed(outboxId, event.companyId, lastFailure);
      }
    } catch (error: unknown) {
      // Persisting the outcome is bookkeeping; a failure here leaves the row unpublished,
      // which is the safe direction (it will be offered for a retry rather than lost).
      this.logger.error(
        `Failed to record delivery outcome for domain event "${event.type}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
