import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/**
 * Exposes Redis to the whole application.
 *
 * Global because sessions (phase 2) and the job queue both need it, and neither should
 * be able to create a connection that ignores the pool sizing and retry policy set here.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
