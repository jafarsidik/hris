import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

/**
 * Employee master data. Employment records that link a `User` identity to an
 * organizational unit and a position. `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
