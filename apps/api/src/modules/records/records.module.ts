import { Module } from '@nestjs/common';

import { DomainEventsModule } from '../events/domain-events.module';
import { LogModule } from '../logs/log.module';
import { RecordActionRegistry } from './record-action.registry';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

/**
 * Generic CRUD runtime for registry-declared resources.
 *
 * `PrismaService` is global through the database module; `LogModule` supplies
 * `LogService` so record writes append an audit entry. `RecordActionRegistry` is
 * exported so business modules can register custom actions without the records module
 * depending on them — the registration direction is inverted.
 */
@Module({
  imports: [LogModule, DomainEventsModule],
  controllers: [RecordsController],
  providers: [RecordsService, RecordActionRegistry],
  exports: [RecordsService, RecordActionRegistry],
})
export class RecordsModule {}
