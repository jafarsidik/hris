import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

/**
 * Organizational structure. `LogModule` supplies the audit trail for entity and unit
 * changes; the service is exported so the access module can validate user placement
 * against the same structure without duplicating the queries.
 */
@Module({
  imports: [LogModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
