import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigurationModule } from './config/app-configuration.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { RedisModule } from './modules/redis/redis.module';

/**
 * Root module.
 *
 * Only platform capabilities are registered at this stage. Business modules are
 * added as their phase is implemented; each one owns its own persistence,
 * authorization and audit concerns.
 *
 * Note: HTTP-wide concerns (security headers, CORS, versioning, validation,
 * error handling, correlation ids) are applied in `configureApp`, not here, so
 * that production and end-to-end tests share one wiring.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Values already present in the real environment always win, so a
      // checked-in development `.env` can never override container or CI
      // configuration.
      envFilePath: ['.env', '../../.env'],
      cache: true,
    }),
    AppConfigurationModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
  ],
})
export class AppModule {}
