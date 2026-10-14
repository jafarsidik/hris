import type { RedisOptions } from 'ioredis';

/**
 * Worker configuration, read directly from the environment.
 *
 * Deliberately independent of the API's `AppConfiguration`: the worker is a separate
 * process with a different surface (no HTTP, no auth secrets), and coupling the two
 * would force every API-only variable to exist just to start the worker.
 */
export interface SmtpConfig {
  readonly host: string | null;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string | null;
  readonly password: string | null;
}

export interface WorkerConfig {
  readonly redis: RedisOptions & {
    readonly host: string;
    readonly port: number;
    readonly db: number;
  };
  readonly smtp: SmtpConfig;
  readonly mailFrom: { readonly address: string; readonly name: string };
  /** Where links in transactional email point. Must be reachable by the recipient. */
  readonly webBaseUrl: string;
  readonly appName: string;
  readonly concurrency: number;
  /**
   * Encrypts webhook signing secrets at rest. The worker must read the same
   * `WEBHOOK_ENCRYPTION_KEY` the API encrypted with, or it cannot sign a delivery.
   */
  readonly webhookEncryptionKey: string | null;
}

function readString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstCorsOrigin(env: NodeJS.ProcessEnv): string | null {
  const origin = (env.CORS_ORIGINS ?? '').split(',')[0]?.trim();
  return origin ? origin : null;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    redis: {
      host: readString(env.REDIS_HOST) ?? 'localhost',
      port: readInt(env.REDIS_PORT, 6381),
      password: readString(env.REDIS_PASSWORD) ?? undefined,
      db: readInt(env.REDIS_DB, 0),
      // Required by BullMQ; a blocked command must not be capped by ioredis.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
    smtp: {
      host: readString(env.SMTP_HOST),
      port: readInt(env.SMTP_PORT, 1025),
      secure: (env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
      user: readString(env.SMTP_USER),
      password: readString(env.SMTP_PASSWORD),
    },
    mailFrom: {
      address: readString(env.MAIL_FROM_ADDRESS) ?? 'no-reply@hris.local',
      name: readString(env.MAIL_FROM_NAME) ?? 'HRIS',
    },
    webBaseUrl: readString(env.WEB_APP_URL) ?? firstCorsOrigin(env) ?? 'http://localhost:3000',
    appName: readString(env.APP_NAME) ?? 'HRIS',
    concurrency: Math.max(1, readInt(env.WORKER_CONCURRENCY, 5)),
    webhookEncryptionKey: readString(env.WEBHOOK_ENCRYPTION_KEY),
  };
}

/** The connection options BullMQ's `Worker` expects. */
export function bullConnectionOptions(config: WorkerConfig): RedisOptions {
  return config.redis;
}
