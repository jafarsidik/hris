import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Company-scoped system settings (brief, Administration: System Settings).
 */
@Module({
  imports: [LogModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
