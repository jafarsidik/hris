import { Module } from '@nestjs/common';

import { DomainEventsModule } from '../events/domain-events.module';
import { LogModule } from '../logs/log.module';
import { NotificationModule } from '../notifications/notification.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { BusinessRulesController } from './business-rules.controller';
import { BusinessRulesService } from './business-rules.service';

/**
 * Business rules: event trigger + condition + actions. Imports the workflow engine
 * (for `START_WORKFLOW`), the notification platform (for `NOTIFY`) and the
 * event bus (both triggers and `EMIT_WEBHOOK`).
 */
@Module({
  imports: [LogModule, NotificationModule, WorkflowModule, DomainEventsModule],
  controllers: [BusinessRulesController],
  providers: [BusinessRulesService],
  exports: [BusinessRulesService],
})
export class BusinessRulesModule {}
