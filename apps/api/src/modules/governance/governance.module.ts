import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { DataPoliciesController } from './data-policies.controller';
import { DataPoliciesService } from './data-policies.service';
import { UserGroupsController } from './user-groups.controller';
import { UserGroupsService } from './user-groups.service';

@Module({
  imports: [LogModule],
  controllers: [UserGroupsController, DataPoliciesController],
  providers: [UserGroupsService, DataPoliciesService],
  exports: [UserGroupsService, DataPoliciesService],
})
export class GovernanceModule {}
