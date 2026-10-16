import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { ApiUsageController } from './api-usage.controller';
import { ApiUsageMiddleware } from './api-usage.middleware';
import { ApiUsageService } from './api-usage.service';

/**
 * Developer API usage: the request log written for machine clients and the read shapes
 * built on it.
 *
 * The middleware is applied to every route so it observes all requests, but it writes a
 * row only when the authentication guard has stamped an API client onto the request; an
 * ordinary session-based request is ignored.
 */
@Module({
  controllers: [ApiUsageController],
  providers: [ApiUsageService, ApiUsageMiddleware],
  exports: [ApiUsageService],
})
export class ApiUsageModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiUsageMiddleware).forRoutes('*');
  }
}
