import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

/**
 * Leave domain: leave type catalogue, entitlement policies and leave requests
 * with an approval lifecycle. `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
