import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

/**
 * Platform metadata registry.
 *
 * `PrismaService` is provided globally through the database module, so it is available
 * without an extra import. `LogModule` supplies `LogService` so registry writes can
 * append an audit record.
 */
@Module({
  imports: [LogModule],
  controllers: [RegistryController],
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule {}
