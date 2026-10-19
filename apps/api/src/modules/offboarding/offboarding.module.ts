import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { OffboardingController } from './offboarding.controller';
import { OffboardingService } from './offboarding.service';

/**
 * Offboarding: exit cases and their clearance checklists. `LogModule`
 * supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [OffboardingController],
  providers: [OffboardingService],
  exports: [OffboardingService],
})
export class OffboardingModule {}
