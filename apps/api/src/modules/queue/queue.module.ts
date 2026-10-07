import { Global, Module } from '@nestjs/common';

import { QueueService } from './queue.service';

/**
 * Background job infrastructure.
 *
 * Global so any module can enqueue work without importing this one. Worker processes
 * are deployed separately and are not part of this application; phase 1 only provides
 * the producer side plus the defaults every job inherits.
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
