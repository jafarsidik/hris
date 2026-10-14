import { type DatabaseClient, withTenantContext } from '@hris/database';
import { SYSTEM_SETTING_DEFAULTS } from '@hris/shared-types';

import type { WorkerConfig } from './config';

/**
 * SMTP relay resolved for one company.
 *
 * `secure` means implicit TLS (SMTPS, usually port 465); port 587 relays use STARTTLS
 * and leave this false.
 */
export interface ResolvedSmtp {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string | null;
  readonly password: string | null;
}

const SETTING_KEYS = [
  'email.smtpHost',
  'email.smtpPort',
  'email.smtpUser',
  'email.smtpPassword',
  'email.smtpSsl',
] as const;

function defaultValue(key: string): unknown {
  return SYSTEM_SETTING_DEFAULTS.find((entry) => entry.key === key)?.value ?? null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Resolves the effective relay for a company: the company's setting when present,
 * otherwise the process environment.
 *
 * An explicit `email.smtpHost` row with a null value disables outbound email for that
 * company, even when the environment defines a relay — otherwise a tenant could never
 * opt out of a shared default.
 */
export async function resolveSmtp(
  prisma: DatabaseClient,
  companyId: string,
  config: WorkerConfig,
): Promise<ResolvedSmtp | null> {
  const rows = await withTenantContext(prisma, companyId, (tx) =>
    tx.systemSetting.findMany({
      where: { companyId, key: { in: [...SETTING_KEYS] } },
      select: { key: true, value: true },
    }),
  );

  const stored = new Map<string, unknown>(rows.map((row) => [row.key, row.value]));
  const get = (key: string): unknown => (stored.has(key) ? stored.get(key) : defaultValue(key));

  const host = stored.has('email.smtpHost') ? asString(get('email.smtpHost')) : config.smtp.host;
  if (!host) {
    return null;
  }

  return {
    host,
    port: asNumber(get('email.smtpPort')) ?? config.smtp.port,
    secure: asBoolean(get('email.smtpSsl')) ?? config.smtp.secure,
    user: asString(get('email.smtpUser')) ?? config.smtp.user,
    password: asString(get('email.smtpPassword')) ?? config.smtp.password,
  };
}
