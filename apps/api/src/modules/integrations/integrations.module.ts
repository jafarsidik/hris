import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailAdapter } from './email.adapter';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { WebhookDispatcher } from './webhook-dispatcher.service';

/**
 * Integration registry. `LogModule` supplies the audit trail for configuration changes
 * and connection tests; `SettingsModule` lets the email adapter resolve the tenant's
 * SMTP relay without ever reading a credential from the integration record. The
 * dispatcher consumes the global event bus and enqueues signed webhook deliveries.
 */
@Module({
  imports: [LogModule, SettingsModule],
  controllers: [IntegrationsController],
  providers: [EmailAdapter, IntegrationsService, WebhookDispatcher],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
