import { Injectable, Logger } from '@nestjs/common';

import type { DomainEvent, DomainEventHandler } from './domain-event.types';

/**
 * In-process publish/subscribe for domain events.
 *
 * Consumers register a handler for an event name at module start-up; producers call
 * {@link emit} after their state change commits. Dispatch is awaited and every
 * consumer is isolated: one subscriber throwing is logged and does not stop the others
 * or fail the producer, because a misbehaving listener must not roll back the action
 * that already succeeded or block an unrelated consumer.
 *
 * A durable, exactly-once transport (an outbox or the job queue) is a later increment;
 * this bus makes the extension point real and testable today without adding a dependency.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, DomainEventHandler[]>();
  private readonly allSubscribers: DomainEventHandler[] = [];

  /** Registers a consumer for an event type. Multiple consumers per type are allowed. */
  subscribe<TPayload>(type: string, handler: DomainEventHandler<TPayload>): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(type, existing);
  }

  /**
   * Registers a consumer for every event type.
   *
   * This is the extension point for a generic fan-out (the webhook dispatcher) that must
   * see events whose names it cannot know at load time. It is deliberately separate from
   * {@link subscribe} so a typed consumer still registers against one name.
   */
  subscribeAll<TPayload>(handler: DomainEventHandler<TPayload>): void {
    this.allSubscribers.push(handler as DomainEventHandler);
  }

  /** True when at least one consumer is registered (used by tests and diagnostics). */
  hasSubscribers(type: string): boolean {
    return (this.handlers.get(type) ?? []).length > 0 || this.allSubscribers.length > 0;
  }

  /**
   * Delivers an event to every subscriber, in registration order.
   *
   * A subscriber that throws is reported and skipped so one faulty consumer cannot
   * deny the others their event. The event has already been persisted by the producer,
   * so swallowing here never hides a rolled-back change.
   */
  async emit<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const subscribers = [...(this.handlers.get(event.type) ?? []), ...this.allSubscribers];
    for (const handler of subscribers) {
      try {
        await handler(event as DomainEvent);
      } catch (error: unknown) {
        this.logger.error(
          `Domain event consumer failed for "${event.type}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
