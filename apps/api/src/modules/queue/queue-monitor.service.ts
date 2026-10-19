import { Inject, Injectable } from '@nestjs/common';
import {
  type PerformanceMetricsSummary,
  type QueueCounts,
  type QueueJobState,
  type QueueJobSummary,
  type QueueLatencySummary,
  type QueuePerformanceSummary,
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

  /**
   * Latency, throughput and saturation across every queue.
   *
   * Samples the jobs BullMQ still retains (the defaults keep the last 1000 completed and
   * 5000 failed per queue), so the window is "recent history" rather than a guaranteed
   * fixed period: throughput counts finish timestamps inside the last hour/day, and
   * latency is `finishedOn - processedOn` over completed jobs. With no worker having run
   * yet the sample is empty and latency reports `null` instead of a fabricated zero.
   */
  async performance(): Promise<PerformanceMetricsSummary> {
    if (!this.queues.isConfigured) {
      return { queues: [], totals: ZERO_TOTALS, sampledAt: new Date().toISOString() };
    }
    const queues = await Promise.all(
      (Object.values(QUEUE_NAMES) as readonly QueueName[]).map((name) => this.performanceFor(name)),
    );
    const totals = queues.reduce<PerformanceMetricsSummary['totals']>(
      (acc, queue) => ({
        waiting: acc.waiting + queue.counts.waiting,
        active: acc.active + queue.counts.active,
        delayed: acc.delayed + queue.counts.delayed,
        failed: acc.failed + queue.counts.failed,
        completedLastHour: acc.completedLastHour + queue.completedLastHour,
      }),
      { ...ZERO_TOTALS },
    );
    return { queues, totals, sampledAt: new Date().toISOString() };
  }

  private async performanceFor(name: QueueName): Promise<QueuePerformanceSummary> {
    const queue = this.queues.getQueue(name);
    const [counts, isPaused, completed, failed] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
      queue.isPaused(),
      queue.getJobs(['completed'], 0, 199, false),
      queue.getJobs(['failed'], 0, 99, false),
    ]);

    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    let completedLastHour = 0;
    let completedLast24h = 0;
    const latencies: number[] = [];
    for (const job of completed) {
      const finished = job.finishedOn ?? 0;
      if (finished >= hourAgo) completedLastHour += 1;
      if (finished >= dayAgo) completedLast24h += 1;
      const processed = job.processedOn;
      if (processed !== undefined && finished >= processed) {
        latencies.push(finished - processed);
      }
    }

    let failedLastHour = 0;
    for (const job of failed) {
      if ((job.finishedOn ?? 0) >= hourAgo) failedLastHour += 1;
    }

    return {
      queue: name,
      isPaused,
      counts: toCounts(counts),
      completedLastHour,
      completedLast24h,
      failedLastHour,
      latency: toLatency(latencies),
    };
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

const ZERO_TOTALS = {
  waiting: 0,
  active: 0,
  delayed: 0,
  failed: 0,
  completedLastHour: 0,
} as const;

/** Percentiles over processing latencies; `null` when there is nothing to sample. */
function toLatency(latencies: readonly number[]): QueueLatencySummary | null {
  if (latencies.length === 0) {
    return null;
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  // A single ordered pass instead of indexed reads: with `noUncheckedIndexedAccess`,
  // `sorted[i]` would be `number | undefined`, and the list is known non-empty here.
  let p95Ms = 0;
  let maxMs = 0;
  let index = 0;
  for (const value of sorted) {
    maxMs = value;
    if (index === p95Index) {
      p95Ms = value;
    }
    index += 1;
  }
  return {
    avgMs: Math.round(sum / sorted.length),
    p95Ms,
    maxMs,
    sample: sorted.length,
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
