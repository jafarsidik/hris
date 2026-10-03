import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';

/**
 * Platform health module (M00).
 *
 * Dependency health indicators for PostgreSQL, Redis, object storage and the
 * background queue are registered here as those adapters are introduced.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
