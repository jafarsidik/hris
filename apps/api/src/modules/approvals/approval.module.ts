import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

/**
 * Approval authority (System -> Access Management).
 *
 * `CryptoModule` is global, so the tenant-aware `PrismaService` is available without
 * an extra import.
 */
@Module({
  imports: [LogModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
