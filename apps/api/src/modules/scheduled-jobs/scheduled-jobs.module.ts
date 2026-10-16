import { Module } from '@nestjs/common';

import { DomainEventsModule } from '../events/domain-events.module';
import { LogModule } from '../logs/log.module';
import { NotificationModule } from '../notifications/notification.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { ScheduledActionsController } from './scheduled-actions.controller';
import { ScheduledActionsService } from './scheduled-actions.service';

@Module({
  imports: [LogModule, NotificationModule, WorkflowModule, DomainEventsModule],
  controllers: [ScheduledActionsController],
  providers: [ScheduledActionsService],
  exports: [ScheduledActionsService],
})
export class ScheduledJobsModule {}
