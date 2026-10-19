import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

/**
 * Payroll: pay periods, salary structures and per-employee payroll
 * calculation. `LogModule` supplies the audit trail.
 */
@Module({
  imports: [LogModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
