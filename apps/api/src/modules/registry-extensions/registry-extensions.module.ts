import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import {
  ConfigurationSchemasController,
  ExtensionsController,
} from './registry-extensions.controller';
import { RegistryExtensionsService } from './registry-extensions.service';

@Module({
  imports: [LogModule],
  controllers: [ConfigurationSchemasController, ExtensionsController],
  providers: [RegistryExtensionsService],
  exports: [RegistryExtensionsService],
})
export class RegistryExtensionsModule {}
