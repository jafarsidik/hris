import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

/**
 * Recruitment: job requisitions, the candidate pool and the application
 * pipeline. `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
