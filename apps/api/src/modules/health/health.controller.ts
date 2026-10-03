import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';

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
 * - `/health/ready` answers "can this instance serve traffic". Dependency
 *   indicators (PostgreSQL, Redis, queue) are attached in phase 1; the endpoint
 *   already returns 503 through the `ServiceUnavailableException` contract when
 *   a future indicator fails.
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
  constructor(@Inject(HealthCheckService) private readonly health: HealthCheckService) {}

  @Get()
  @ApiExcludeEndpoint()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([]);
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
    return this.health.check([]);
  }
}