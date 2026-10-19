import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { EmployeeRecordsController } from './employee-records.controller';
import { EmployeeRecordsService } from './employee-records.service';

/**
 * Employee Data sub-records: emergency contacts, family (with dependents),
 * education, experience, skills, certifications and documents. `LogModule`
 * supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [EmployeeRecordsController],
  providers: [EmployeeRecordsService],
  exports: [EmployeeRecordsService],
})
export class EmployeeRecordsModule {}
