import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { OutboxService } from './outbox.service';

/**
 * Durable domain events.
 *
 * Global so a producer module can emit and a consumer module can subscribe without
 * each wiring the other: the bus is the only shared dependency, which is what keeps an
 * added domain application isolated from the modules it reacts to. `OutboxService` and
 * the registry are exported with it because both the producer path (the bus) and the
 * automation surfaces (rules, the registry) need them.
 */
@Global()
@Module({
  controllers: [EventsController],
  providers: [OutboxService, DomainEventBus, EventsService],
  exports: [DomainEventBus, OutboxService],
})
export class DomainEventsModule {}
