import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { NotificationModule } from '../notifications/notification.module';
import {
  WorkflowDefinitionsController,
  WorkflowInstancesController,
  WorkflowTasksController,
} from './workflow.controller';
import { WorkflowService } from './workflow.service';

/**
 * Configurable workflow engine. `PrismaService` is global through the database module;
 * `LogModule` supplies `LogService` so published versions and every transition are
 * audited; `NotificationModule` supplies `NotificationService` so task assignment
 * reaches approvers. `QueueModule` is global, so SLA timers can be enqueued.
 * Exported so business modules can drive workflows without owning the engine.
 */
@Module({
  imports: [LogModule, NotificationModule],
  controllers: [
    WorkflowDefinitionsController,
    WorkflowInstancesController,
    WorkflowTasksController,
  ],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
