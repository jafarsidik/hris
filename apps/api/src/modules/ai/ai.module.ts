import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { SettingsModule } from '../settings/settings.module';
import { AiController } from './ai.controller';
import { AiGateway } from './ai-gateway.service';
import { AiProviderService } from './ai-provider.service';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [LogModule, SettingsModule],
  controllers: [AiController],
  providers: [AiProviderService, KnowledgeService, AiGateway],
  exports: [AiGateway, KnowledgeService],
})
export class AiModule {}
