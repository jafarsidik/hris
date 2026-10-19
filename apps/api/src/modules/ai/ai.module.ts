import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { SettingsModule } from '../settings/settings.module';
import {
  AiAgentsController,
  AiModelsController,
  AiPromptsController,
  AiToolsController,
} from './ai-registry.controller';
import { AiRegistryService } from './ai-registry.service';
import { AiUsageService } from './ai-usage.service';
import { AiController } from './ai.controller';
import { AiGateway } from './ai-gateway.service';
import { AiProviderService } from './ai-provider.service';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [LogModule, SettingsModule],
  controllers: [
    AiController,
    AiModelsController,
    AiPromptsController,
    AiAgentsController,
    AiToolsController,
  ],
  providers: [AiProviderService, KnowledgeService, AiGateway, AiRegistryService, AiUsageService],
  exports: [AiGateway, KnowledgeService],
})
export class AiModule {}
