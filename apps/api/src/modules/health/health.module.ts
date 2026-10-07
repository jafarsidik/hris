import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';

import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { QueueHealthIndicator } from './indicators/queue.health';
import { RedisHealthIndicator } from './indicators/redis.health';

/**
 * Platform health module (M00).
 *
 * Liveness and readiness are deliberately different:
 *
 * - `/health/live` checks nothing external, so a database outage cannot cause the
 *   orchestrator to restart a process that is perfectly able to recover.
 * - `/health/ready` checks PostgreSQL, Redis and the queue, and returns 503 when any of
 *   them is unreachable, so traffic is steered away from an instance that cannot serve a
 *   request.
 *
 * `@nestjs/terminus` ships a `PrismaHealthIndicator`, but it has not been maintained
 * across major versions and its Prisma peer range does not cover Prisma 7, so the
 * database check is written here instead. That is also why the check is a `SELECT 1`
 * rather than a table read: see the comment on the indicator.
 */
@Module({
  imports: [TerminusModule, DatabaseModule, RedisModule, QueueModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
