import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { AccessReviewsController } from './access-reviews.controller';
import { AccessReviewsService } from './access-reviews.service';
import { ServiceAccountsController } from './service-accounts.controller';
import { ServiceAccountsService } from './access-reviews.service';

@Module({
  imports: [LogModule],
  controllers: [AccessReviewsController, ServiceAccountsController],
  providers: [AccessReviewsService, ServiceAccountsService],
  exports: [AccessReviewsService, ServiceAccountsService],
})
export class AccessGovernanceModule {}
