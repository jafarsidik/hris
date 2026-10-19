import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

/**
 * Organizational structure. `LogModule` supplies the audit trail for entity, unit
 * and location changes; the services are exported so the access module can validate
 * user placement against the same structure without duplicating the queries.
 */
@Module({
  imports: [LogModule],
  controllers: [OrganizationController, LocationController],
  providers: [OrganizationService, LocationService],
  exports: [OrganizationService, LocationService],
})
export class OrganizationModule {}
