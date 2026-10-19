import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { EmploymentController } from './employment.controller';
import { EmploymentService } from './employment.service';

/**
 * Employment agreements and organizational movements. `LogModule` supplies
 * the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [EmploymentController],
  providers: [EmploymentService],
  exports: [EmploymentService],
})
export class EmploymentModule {}
