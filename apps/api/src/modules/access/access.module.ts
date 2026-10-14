import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { NotificationModule } from '../notifications/notification.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

/**
 * Administration of users, roles, permissions and user sessions (brief M07).
 *
 * Reads require view grants and mutations their own action grants; all records are
 * tenant-scoped through `withTenantContext` inside the service.
 */
@Module({
  imports: [LogModule, NotificationModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
