import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

/**
 * Performance: review cycles, employee goals and manager appraisals.
 * `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
