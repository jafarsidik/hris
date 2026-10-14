import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { ApiClientsController } from './api-clients.controller';
import { ApiClientsService } from './api-clients.service';

/**
 * Developer API client management. `PrismaService` is global through the database
 * module; `LogModule` supplies `LogService` so credential changes are audited.
 */
@Module({
  imports: [LogModule],
  controllers: [ApiClientsController],
  providers: [ApiClientsService],
  exports: [ApiClientsService],
})
export class ApiClientsModule {}
