import { Module } from '@nestjs/common';

import { DomainEventsModule } from '../events/domain-events.module';
import { LogModule } from '../logs/log.module';
import { RecordsModule } from '../records/records.module';
import { ExampleProjectsBootstrap } from './example-projects.bootstrap';
import { TaskEventsConsumer } from './task-events.consumer';

/**
 * Example domain application "Projects" (Phase 5b).
 *
 * Deliberately does not own storage, controllers or authorization: it is metadata
 * (seeded application, module, `project`/`task` resources and their fields/actions)
 * plus two small pieces of code — a custom `task.complete` action and a
 * `task.completed` consumer. It proves a domain can be added to the platform by
 * registering metadata and plugging into generic extension points, without edits to
 * core modules.
 */
@Module({
  imports: [RecordsModule, LogModule, DomainEventsModule],
  providers: [ExampleProjectsBootstrap, TaskEventsConsumer],
})
export class ExampleProjectsModule {}
