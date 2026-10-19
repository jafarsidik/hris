import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

/**
 * Attendance & Time: daily employee attendance records and reusable shift
 * patterns. `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
