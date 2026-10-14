import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common';

import {
  QUEUE_JOB_STATES,
  type QueueJobState,
  type QueueJobSummary,
  type QueueSummary,
} from '@hris/shared-types';

import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { QueueMonitorService } from './queue-monitor.service';

class JobQuery {
  @IsOptional()
  @IsIn(QUEUE_JOB_STATES)
  state: QueueJobState = 'failed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

class QueueParams {
  @IsString()
  name!: string;
}

class JobParams {
  @IsString()
  name!: string;

  @IsString()
  jobId!: string;
}

/**
 * Background job monitoring and operations (System -> Operations).
 *
 * Reading queue health is `queue:view`; retrying, removing and pausing are
 * `queue:manage`. Both are separate grants because observing a backlog and being able
 * to discard failed jobs are different levels of trust.
 */
@Controller('platform/queues')
export class QueueMonitorController {
  constructor(@Inject(QueueMonitorService) private readonly monitor: QueueMonitorService) {}

  @Get()
  @RequirePermission('queue', 'view')
  async list(): Promise<QueueSummary[]> {
    return this.monitor.list();
  }

  @Get(':name')
  @RequirePermission('queue', 'view')
  async summary(@Param() params: QueueParams): Promise<QueueSummary> {
    return this.monitor.summarise(params.name);
  }

  @Get(':name/jobs')
  @RequirePermission('queue', 'view')
  async jobs(@Param() params: QueueParams, @Query() query: JobQuery): Promise<QueueJobSummary[]> {
    return this.monitor.listJobs(params.name, query.state, query.limit);
  }

  @Post(':name/jobs/:jobId/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('queue', 'manage')
  async retry(@Param() params: JobParams): Promise<void> {
    await this.monitor.retry(params.name, params.jobId);
  }

  @Post(':name/jobs/:jobId/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('queue', 'manage')
  async remove(@Param() params: JobParams): Promise<void> {
    await this.monitor.remove(params.name, params.jobId);
  }

  @Post(':name/pause')
  @RequirePermission('queue', 'manage')
  async pause(@Param() params: QueueParams): Promise<QueueSummary> {
    return this.monitor.pause(params.name);
  }

  @Post(':name/resume')
  @RequirePermission('queue', 'manage')
  async resume(@Param() params: QueueParams): Promise<QueueSummary> {
    return this.monitor.resume(params.name);
  }
}
