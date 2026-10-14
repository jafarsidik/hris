import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { WorkflowDefinitionsController, WorkflowInstancesController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

/**
 * Configurable workflow engine. `PrismaService` is global through the database module;
 * `LogModule` supplies `LogService` so published versions and every transition are
 * audited. Exported so business modules can drive workflows without owning the engine.
 */
@Module({
  imports: [LogModule],
  controllers: [WorkflowDefinitionsController, WorkflowInstancesController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
