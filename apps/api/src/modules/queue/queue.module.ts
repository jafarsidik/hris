import { Global, Module } from '@nestjs/common';

import { QueueMonitorController } from './queue-monitor.controller';
import { QueueMonitorService } from './queue-monitor.service';
import { QueueService } from './queue.service';

/**
 * Background job infrastructure.
 *
 * Global so any module can enqueue work without importing this one. Worker processes
 * are deployed separately and are not part of this application; this module provides
 * the producer side plus the monitoring surface the Operations screens read.
 */
@Global()
@Module({
  controllers: [QueueMonitorController],
  providers: [QueueService, QueueMonitorService],
  exports: [QueueService, QueueMonitorService],
})
export class QueueModule {}
