import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * Notification platform (System -> Communication).
 *
 * `NotificationService` is exported so business modules (auth, access, settings)
 * can emit events through the single `emit` pipeline instead of writing delivery
 * rows themselves. `QueueModule` is global, so email delivery can be deferred
 * without importing it here.
 */
@Module({
  imports: [LogModule, SettingsModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
