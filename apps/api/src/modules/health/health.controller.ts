import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';

import { PrismaHealthIndicator } from './indicators/prisma.health';
import { QueueHealthIndicator } from './indicators/queue.health';
import { RedisHealthIndicator } from './indicators/redis.health';

interface LivenessResult {
  readonly status: 'ok';
  readonly service: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
}

/**
 * Liveness and readiness probes.
 *
 * - `/health/live` answers "is the process running". It touches no dependency so
 *   that a slow database can never cause the orchestrator to kill a healthy pod.
 * - `/health/ready` answers "can this instance serve traffic" and covers
 *   PostgreSQL, Redis and the job queue. Terminus raises
 *   `ServiceUnavailableException` when any of them fails, which the exception
 *   filter renders as a 503, so an orchestrator stops routing traffic here.
 * - `/health` is a convenience roll-up for humans and dashboards.
 *
 * All three are exempt from authentication and API versioning so that
 * infrastructure probes keep a stable URL, and they opt out of the response
 * envelope so that probe output stays plain, well-known JSON.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
@RawResponse()
export class HealthController {
  // Explicit token so injection never depends on `emitDecoratorMetadata`
  // resolving `HealthCheckService` at runtime.
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator)
    private readonly database: PrismaHealthIndicator,
    @Inject(RedisHealthIndicator)
    private readonly redis: RedisHealthIndicator,
    @Inject(QueueHealthIndicator)
    private readonly queue: QueueHealthIndicator,
  ) {}

  /**
   * Every dependency the API cannot serve a request without.
   *
   * Order is not significant; Terminus runs them concurrently. Object keys must match
   * the indicator keys, otherwise Terminus rejects the result, which is a useful guard
   * against a renamed indicator silently disappearing from the payload.
   */
  private readinessIndicators() {
    return [
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.queue.isHealthy('queue'),
    ];
  }

  @Get()
  @ApiExcludeEndpoint()
  async check(): Promise<HealthCheckResult> {
    return this.health.check(this.readinessIndicators());
  }

  @Get('live')
  @ApiExcludeEndpoint()
  liveness(): LivenessResult {
    return {
      status: 'ok',
      service: 'hris-api',
      environment: process.env['NODE_ENV'] ?? 'development',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  @ApiExcludeEndpoint()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check(this.readinessIndicators());
  }
}
