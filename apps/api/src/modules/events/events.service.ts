import { Inject, Injectable } from '@nestjs/common';

import { EVENT_TYPE_CATALOGUE, type EventRegistrySnapshot } from '@hris/shared-types';

import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { DomainEventBus } from './domain-event-bus.service';
import { OutboxService, type OutboxListFilter } from './outbox.service';

/** The filters a registry read accepts (the limit is resolved by the controller). */
export type EventRegistryFilter = Omit<OutboxListFilter, 'limit'> & { readonly limit: number };

/**
 * Reads the Event Registry: the catalogue of reactive event types and the tenant's
 * recent domain events.
 *
 * The registry answers two questions for an automation author. First, *what can I react
 * to* — the catalogue in `@hris/shared-types`, served here so the client never invents a
 * type the API does not emit. Second, *what has actually happened* — the outbox rows,
 * including any still owed a delivery, which the same author can retry.
 */
@Injectable()
export class EventsService {
  constructor(
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(DomainEventBus) private readonly bus: DomainEventBus,
  ) {}

  /** The catalogue plus the tenant's recent events, in one round trip. */
  async snapshot(companyId: string, filter: EventRegistryFilter): Promise<EventRegistrySnapshot> {
    const [recent, pending] = await Promise.all([
      this.outbox.list(companyId, filter),
      this.outbox.countPending(companyId),
    ]);
    return { types: EVENT_TYPE_CATALOGUE, recent, pending };
  }

  /**
   * Re-runs the consumers for one event that is still owed a delivery.
   *
   * Only an unpublished event can be retried: a published one has already reached every
   * consumer, and re-sending it would duplicate a side effect for no gain.
   */
  async retry(companyId: string, id: string): Promise<void> {
    const record = await this.outbox.findForRetry(companyId, id);
    if (record === null) {
      throw new NotFoundError('The event does not exist.');
    }
    if (record.publishedAt !== null) {
      throw new ConflictError('The event has already been delivered to every consumer.');
    }
    await this.bus.redeliver(record.event, record.id);
  }
}
