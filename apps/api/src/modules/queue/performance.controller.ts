import { Controller, Get, Inject } from '@nestjs/common';

import type { PerformanceMetricsSummary } from '@hris/shared-types';

import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { QueueMonitorService } from './queue-monitor.service';

/**
 * Latency, throughput and saturation for Operations -> Performance Metrics.
 *
 * A dedicated controller rather than a route inside `platform/queues`: there the `:name`
 * wildcard would swallow a literal `metrics` segment, and a route-order dependency like
 * that is one refactor away from silently returning a 404 for an unknown queue.
 */
@Controller('platform/performance')
export class PerformanceController {
  constructor(@Inject(QueueMonitorService) private readonly monitor: QueueMonitorService) {}

  @Get()
  @RequirePermission('queue', 'view')
  async metrics(): Promise<PerformanceMetricsSummary> {
    return this.monitor.performance();
  }
}
