import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus.service';

/**
 * In-process domain event bus.
 *
 * Global so a producer module can emit and a consumer module can subscribe without
 * each wiring the other: the bus is the only shared dependency, which is what keeps an
 * added domain application isolated from the modules it reacts to.
 */
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class DomainEventsModule {}
