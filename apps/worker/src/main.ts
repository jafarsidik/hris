import { createPrismaClient } from '@hris/database';

import { loadWorkerConfig } from './config';
import { createLogger } from './logger';
import { createNotificationsWorker } from './processors';
import { createWebhookWorker } from './webhook-processor';
import { createWorkflowWorker } from './workflow-processor';

/**
 * Background worker entrypoint.
 *
 * Runs as a separate process from the API so email throughput and provider latency do
 * not compete with request handling, and so the API can scale horizontally without
 * multiplying worker concurrency. It shares the database and Redis contracts with the
 * API but none of its HTTP surface.
 */
async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = createLogger(process.env.LOG_LEVEL ?? 'info');
  const prisma = createPrismaClient({ poolSize: 5 });

  // Both queues share this process: they are I/O-bound, and one set of Redis connections
  // is cheaper than two processes while still letting each queue hold its own concurrency.
  const workers = [
    createNotificationsWorker({ config, prisma, logger }),
    createWebhookWorker({ config, prisma, logger }),
    createWorkflowWorker({ config, prisma, logger }),
  ];

  logger.info('Worker started', {
    queues: workers.map((worker) => worker.name),
    concurrency: config.concurrency,
    redis: `${config.redis.host}:${config.redis.port}/${config.redis.db}`,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    try {
      // `close()` waits for in-flight jobs to finish before returning, so a deploy does
      // not abandon an email or webhook that is midway through its attempt.
      await Promise.all(workers.map((worker) => worker.close()));
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error: unknown) {
      logger.error('Shutdown failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap().catch((error: unknown) => {
  // A failure to connect must be loud and fatal: unlike the API, this process has no
  // readiness endpoint to report through, so staying alive would only hide the fault.
  process.stderr.write(
    `Worker failed to start: ${error instanceof Error ? error.message : 'unknown'}\n`,
  );
  process.exit(1);
});
