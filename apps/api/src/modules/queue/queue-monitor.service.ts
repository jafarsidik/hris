import { Inject, Injectable } from '@nestjs/common';
import {
  type QueueCounts,
  type QueueJobState,
  type QueueJobSummary,
  type QueueSummary,
} from '@hris/shared-types';
import type { Job, JobType } from 'bullmq';

import { NotFoundError, ServiceUnavailableError } from '../../common/errors/app-error';
import { QUEUE_NAMES, type QueueName, QueueService } from './queue.service';

/**
 * Read/operate surface over the BullMQ queues for the System -> Operations screens.
 *
 * Deliberately a thin projection: the API is a producer and does not run workers, but
 * BullMQ exposes queue contents over the same Redis connection the producer already
 * holds, so no worker-side IPC is needed to report health or retry a job.
 */
@Injectable()
export class QueueMonitorService {
  constructor(@Inject(QueueService) private readonly queues: QueueService) {}

  private requireConfigured(): void {
    if (!this.queues.isConfigured) {
      throw new ServiceUnavailableError('Background jobs require Redis, which is not configured.');
    }
  }

  private resolveQueue(name: string): QueueName {
    const known = Object.values(QUEUE_NAMES) as readonly string[];
    if (!known.includes(name)) {
      throw new NotFoundError(`Unknown queue "${name}".`);
    }
    return name as QueueName;
  }

  async list(): Promise<QueueSummary[]> {
    if (!this.queues.isConfigured) {
      return [];
    }
    return Promise.all(
      (Object.values(QUEUE_NAMES) as readonly QueueName[]).map((name) => this.summarise(name)),
    );
  }

  async summarise(name: string): Promise<QueueSummary> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    const [counts, isPaused] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
      queue.isPaused(),
    ]);
    return { name: queue.name, isPaused, counts: toCounts(counts) };
  }

  async listJobs(name: string, state: QueueJobState, limit: number): Promise<QueueJobSummary[]> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    const jobs = await queue.getJobs([state as JobType], 0, limit - 1, false);
    return Promise.all(jobs.map((job) => toSummary(job, state)));
  }

  async retry(name: string, jobId: string): Promise<void> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundError(`Job "${jobId}" does not exist in "${name}".`);
    }
    await job.retry();
  }

  async remove(name: string, jobId: string): Promise<void> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundError(`Job "${jobId}" does not exist in "${name}".`);
    }
    await job.remove();
  }

  async pause(name: string): Promise<QueueSummary> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    await queue.pause();
    return this.summarise(name);
  }

  async resume(name: string): Promise<QueueSummary> {
    this.requireConfigured();
    const queue = this.queues.getQueue(this.resolveQueue(name));
    await queue.resume();
    return this.summarise(name);
  }
}

function toCounts(raw: Record<string, number>): QueueCounts {
  return {
    waiting: raw.waiting ?? 0,
    active: raw.active ?? 0,
    completed: raw.completed ?? 0,
    failed: raw.failed ?? 0,
    delayed: raw.delayed ?? 0,
    paused: raw.paused ?? 0,
  };
}

async function toSummary(job: Job, fallbackState: QueueJobState): Promise<QueueJobSummary> {
  const state = (await job.getState()) as QueueJobState;
  return {
    id: job.id ?? '',
    name: job.name,
    state: state ?? fallbackState,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    enqueuedAt: new Date(job.timestamp).toISOString(),
    processedAt: job.processedOn === undefined ? null : new Date(job.processedOn).toISOString(),
    finishedAt: job.finishedOn === undefined ? null : new Date(job.finishedOn).toISOString(),
  };
}
