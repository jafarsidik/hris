import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { DataRetentionController } from './data-retention.controller';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [LogModule],
  controllers: [DataRetentionController],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
