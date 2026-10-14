import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  INTEGRATION_KINDS,
  WEBHOOK_WILDCARD,
  type IntegrationConnectionTestResult,
  type IntegrationDeliverySummary,
  type IntegrationKind,
  type IntegrationSummary,
  type WebhookSecretRotation,
  type WebhookSubscriptionSummary,
} from '@hris/shared-types';

import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import {
  ConflictError,
  NotFoundError,
  OutOfScopeError,
  ValidationError,
} from '../../common/errors/app-error';
import { CredentialCipherService } from '../../common/crypto/credential-cipher.service';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { EmailAdapter } from './email.adapter';
import type { IntegrationAdapter } from './integration.adapter';
import { readUrl, WebhookAdapter } from './webhook.adapter';

export interface IntegrationActor {
  readonly companyId: string;
  readonly userId: string;
}

export interface IntegrationInput {
  key: string;
  name: string;
  kind: IntegrationKind;
  provider: string;
  config?: Record<string, unknown>;
  isEnabled?: boolean;
  /** Event types a WEBHOOK integration subscribes to; defaults to `['*']`. */
  events?: readonly string[];
}

const KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,63}$/;

/** Stateless, so one shared instance serves every request. */
const WEBHOOK_ADAPTER = new WebhookAdapter();
const SECRET_KEY_PATTERN = /(secret|password|passwd|token|api[_-]?key|private[_-]?key|credential)/i;

/**
 * Integration registry.
 *
 * Stores each tenant's configured integrations and runs their connection tests through
 * the matching adapter. The registry never persists a credential: `config` is validated
 * to reject secret-like keys, and adapters read secrets from encrypted System Settings.
 * Every test outcome is appended to `integration_deliveries` and reflected on the
 * integration's health fields, and the status is audited.
 */
@Injectable()
export class IntegrationsService {
  private readonly adapters: ReadonlyMap<IntegrationKind, IntegrationAdapter>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(EmailAdapter) private readonly emailAdapter: EmailAdapter,
    @Inject(CredentialCipherService) private readonly cipher: CredentialCipherService,
  ) {
    this.adapters = new Map<IntegrationKind, IntegrationAdapter>([
      [this.emailAdapter.kind, this.emailAdapter],
      [WEBHOOK_ADAPTER.kind, WEBHOOK_ADAPTER],
    ]);
  }

  async list(
    companyId: string,
    principal: SessionPrincipal,
  ): Promise<readonly IntegrationSummary[]> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.integration.findMany({
        where: integrationScopeWhere(decision),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toSummary);
    });
  }

  async get(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
  ): Promise<IntegrationSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.integration.findFirst({
        where: { id, ...integrationScopeWhere(decision) },
      });
      if (row === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      return toSummary(row);
    });
  }

  /**
   * Reads an integration without a data-scope predicate.
   *
   * For internal callers that have already authorised the action by another route — the
   * update path reads the row to validate a merged payload — scope would be redundant.
   * Public reads go through {@link get}, which applies the caller's scope.
   */
  private async getUnscoped(companyId: string, id: string): Promise<IntegrationSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.integration.findFirst({ where: { id } });
      if (row === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      return toSummary(row);
    });
  }

  /**
   * The caller's record scope for reading integrations, or a hard denial when the grant
   * cannot be resolved. The controller has already checked `integration:view`; this only
   * narrows *which* rows that capability reaches.
   */
  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'integration', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for integration.view cannot be resolved.`,
      );
    }
    return decision;
  }

  async create(actor: IntegrationActor, input: IntegrationInput): Promise<IntegrationSummary> {
    this.assertInput(input);
    const adapter = this.adapters.get(input.kind);
    if (!adapter) {
      throw new ValidationError(`No adapter is available for the "${input.kind}" kind yet.`);
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.integration.findFirst({
        where: { key: input.key },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('An integration with that key already exists.');
      }
      const row = await tx.integration.create({
        data: {
          companyId: actor.companyId,
          key: input.key,
          name: input.name,
          kind: input.kind,
          provider: input.provider,
          config: (input.config ?? {}) as Prisma.InputJsonValue,
          isEnabled: input.isEnabled ?? true,
          createdBy: actor.userId,
        },
      });
      if (input.kind === 'WEBHOOK') {
        await this.writeSubscriptions(tx, actor, row.id, input.events ?? [WEBHOOK_WILDCARD]);
      }
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.create',
        resource: 'integration',
        resourceId: row.id,
        payload: { key: input.key, kind: input.kind },
      });
      return toSummary(row);
    });
  }

  async update(
    actor: IntegrationActor,
    id: string,
    input: Partial<IntegrationInput>,
  ): Promise<IntegrationSummary> {
    if (input.kind !== undefined || input.provider !== undefined || input.config !== undefined) {
      const current = await this.getUnscoped(actor.companyId, id);
      const merged: IntegrationInput = {
        key: input.key ?? current.key,
        name: input.name ?? current.name,
        kind: input.kind ?? current.kind,
        provider: input.provider ?? current.provider,
        config: input.config ?? (current.config as Record<string, unknown>),
        isEnabled: input.isEnabled ?? current.isEnabled,
      };
      this.assertInput(merged);
      if (!this.adapters.has(merged.kind)) {
        throw new ValidationError(`No adapter is available for the "${merged.kind}" kind yet.`);
      }
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.integration.findFirst({ where: { id }, select: { id: true } });
      if (existing === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      const row = await tx.integration.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.provider === undefined ? {} : { provider: input.provider.trim() }),
          ...(input.kind === undefined ? {} : { kind: input.kind }),
          ...(input.config === undefined ? {} : { config: input.config as Prisma.InputJsonValue }),
          ...(input.isEnabled === undefined ? {} : { isEnabled: input.isEnabled }),
          createdBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.update',
        resource: 'integration',
        resourceId: id,
      });
      return toSummary(row);
    });
  }

  async remove(actor: IntegrationActor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.integration.findFirst({ where: { id }, select: { id: true } });
      if (existing === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      await tx.integration.update({
        where: { id },
        data: { deletedAt: new Date(), createdBy: actor.userId },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.delete',
        resource: 'integration',
        resourceId: id,
      });
    });
  }

  async testConnection(
    actor: IntegrationActor,
    id: string,
  ): Promise<IntegrationConnectionTestResult> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const integration = await tx.integration.findFirst({ where: { id } });
      if (integration === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      const adapter = this.adapters.get(integration.kind);
      if (!adapter) {
        throw new ValidationError(
          `No adapter is available for the "${integration.kind}" kind yet.`,
        );
      }

      const startedAt = Date.now();
      const result = await adapter.testConnection({
        companyId: actor.companyId,
        integrationKey: integration.key,
        provider: integration.provider,
        config: (integration.config ?? {}) as Record<string, unknown>,
      });
      const durationMs = Date.now() - startedAt;
      const status = result.ok ? 'CONNECTED' : 'DISCONNECTED';
      const checkedAt = new Date();

      await tx.integration.update({
        where: { id },
        data: {
          status,
          lastCheckedAt: checkedAt,
          lastMessage: result.message,
          createdBy: actor.userId,
        },
      });
      await tx.integrationDelivery.create({
        data: {
          companyId: actor.companyId,
          integrationId: id,
          direction: 'OUTBOUND',
          operation: 'connection_test',
          status: result.ok ? 'SUCCEEDED' : 'FAILED',
          attempt: 1,
          error: result.ok ? null : result.message,
          durationMs,
          request: { kind: integration.kind, provider: integration.provider },
          response: { ok: result.ok, message: result.message } as Prisma.InputJsonValue,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.test',
        resource: 'integration',
        resourceId: id,
        payload: { ok: result.ok },
      });

      return { ok: result.ok, status, message: result.message, checkedAt: checkedAt.toISOString() };
    });
  }

  async listDeliveries(
    companyId: string,
    integrationId: string,
  ): Promise<readonly IntegrationDeliverySummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const integration = await tx.integration.findFirst({
        where: { id: integrationId },
        select: { id: true },
      });
      if (integration === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      const rows = await tx.integrationDelivery.findMany({
        where: { integrationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      });
      return rows.map(toDeliverySummary);
    });
  }

  async listSubscriptions(
    companyId: string,
    integrationId: string,
  ): Promise<readonly WebhookSubscriptionSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const integration = await tx.integration.findFirst({
        where: { id: integrationId },
        select: { id: true, kind: true },
      });
      if (integration === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      const rows = await tx.webhookSubscription.findMany({
        where: { integrationId },
        orderBy: { eventType: 'asc' },
      });
      return rows.map(toSubscriptionSummary);
    });
  }

  /** Replaces the full set of event types a webhook is subscribed to. */
  async replaceSubscriptions(
    actor: IntegrationActor,
    integrationId: string,
    eventTypes: readonly string[],
  ): Promise<readonly WebhookSubscriptionSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const integration = await tx.integration.findFirst({
        where: { id: integrationId },
        select: { id: true, kind: true },
      });
      if (integration === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      if (integration.kind !== 'WEBHOOK') {
        throw new ValidationError('Only a webhook integration has event subscriptions.');
      }
      await tx.webhookSubscription.deleteMany({ where: { integrationId } });
      await this.writeSubscriptions(tx, actor, integrationId, eventTypes);
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.subscriptions',
        resource: 'integration',
        resourceId: integrationId,
        payload: { count: normalizeEvents(eventTypes).length },
      });
      const rows = await tx.webhookSubscription.findMany({
        where: { integrationId },
        orderBy: [{ eventType: 'asc' }],
      });
      return rows.map(toSubscriptionSummary);
    });
  }

  /**
   * Issues a new signing secret for a webhook endpoint.
   *
   * The plaintext is returned exactly once, in this response; only the encrypted
   * envelope is stored, so a later read cannot reveal it. Rotating invalidates the
   * previous secret immediately.
   */
  async rotateWebhookSecret(actor: IntegrationActor, id: string): Promise<WebhookSecretRotation> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const integration = await tx.integration.findFirst({
        where: { id },
        select: { id: true, kind: true },
      });
      if (integration === null) {
        throw new NotFoundError('The integration does not exist.');
      }
      if (integration.kind !== 'WEBHOOK') {
        throw new ValidationError('Only a webhook integration has a signing secret.');
      }

      const secret = `whsec_${randomBytes(32).toString('base64url')}`;
      await tx.integration.update({
        where: { id },
        data: { secretCiphertext: this.cipher.encrypt('webhook', secret), createdBy: actor.userId },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'integration.rotate_secret',
        resource: 'integration',
        resourceId: id,
      });

      return { integrationId: id, secret, rotatedAt: new Date().toISOString() };
    });
  }

  /**
   * Replaces an integration's subscriptions with exactly `eventTypes`.
   *
   * Deletes then inserts so a caller sends the desired set rather than a diff; the
   * unique index would otherwise reject a re-sent identical list.
   */
  private async writeSubscriptions(
    tx: Prisma.TransactionClient,
    actor: IntegrationActor,
    integrationId: string,
    eventTypes: readonly string[],
  ): Promise<void> {
    const unique = normalizeEvents(eventTypes);
    if (unique.length === 0) {
      return;
    }
    await tx.webhookSubscription.createMany({
      data: unique.map((eventType) => ({
        companyId: actor.companyId,
        integrationId,
        eventType,
        createdBy: actor.userId,
      })),
      skipDuplicates: true,
    });
  }

  private assertInput(input: IntegrationInput): void {
    if (!KEY_PATTERN.test(input.key)) {
      throw new ValidationError(
        'The integration key must start with a letter and contain only lower-case letters, digits, dots, dashes and underscores.',
      );
    }
    if (input.name.trim().length === 0 || input.name.length > 120) {
      throw new ValidationError(
        'The integration name is required and must be at most 120 characters.',
      );
    }
    if (!(INTEGRATION_KINDS as readonly string[]).includes(input.kind)) {
      throw new ValidationError(`Unknown integration kind "${input.kind}".`);
    }
    if (input.provider.trim().length === 0 || input.provider.length > 64) {
      throw new ValidationError(
        'The integration provider is required and must be at most 64 characters.',
      );
    }
    if (input.kind === 'WEBHOOK' && readUrl(input.config ?? {}) === null) {
      throw new ValidationError(
        'A webhook integration requires a config.url that is an absolute http(s) URL.',
      );
    }
    assertNoSecretKeys(input.config ?? {});
  }
}

/** Rejects secret-like configuration keys so credentials never land in the registry. */
function assertNoSecretKeys(config: Record<string, unknown>, path = ''): void {
  for (const [key, value] of Object.entries(config)) {
    const location = path === '' ? key : `${path}.${key}`;
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new ValidationError(
        `Configuration key "${location}" looks like a credential; store secrets in System Settings instead.`,
      );
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertNoSecretKeys(value as Record<string, unknown>, location);
    }
  }
}

/** Trims, drops blanks and de-duplicates an event-type list, preserving order. */
function normalizeEvents(eventTypes: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const raw of eventTypes) {
    const type = raw.trim();
    if (type !== '') {
      seen.add(type);
    }
  }
  return [...seen];
}

/**
 * Narrows an integration read to the caller's record scope.
 *
 * `GLOBAL`/`COMPANY` reach the whole tenant (the company boundary is already enforced by
 * row-level security). `SELF` reaches only the rows the caller created. Integrations are
 * tenant-level configuration with no organizational dimension, so a `TEAM`/`DEPARTMENT`/
 * `ENTITY` grant cannot be honoured: rather than silently widening it to every row, the
 * predicate matches nothing.
 */
function integrationScopeWhere(decision: ScopeDecision): Prisma.IntegrationWhereInput {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return { createdBy: decision.userId };
    default:
      return { id: { in: [] } };
  }
}

function toSummary(row: {
  id: string;
  key: string;
  name: string;
  kind: string;
  provider: string;
  config: unknown;
  isEnabled: boolean;
  secretCiphertext: string | null;
  status: string;
  lastCheckedAt: Date | null;
  lastMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IntegrationSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind as IntegrationSummary['kind'],
    provider: row.provider,
    isEnabled: row.isEnabled,
    secretConfigured: row.secretCiphertext !== null,
    status: row.status as IntegrationSummary['status'],
    lastCheckedAt: row.lastCheckedAt === null ? null : row.lastCheckedAt.toISOString(),
    lastMessage: row.lastMessage,
    config: (row.config ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSubscriptionSummary(row: {
  id: string;
  integrationId: string;
  eventType: string;
  isActive: boolean;
  createdAt: Date;
}): WebhookSubscriptionSummary {
  return {
    id: row.id,
    integrationId: row.integrationId,
    eventType: row.eventType,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDeliverySummary(row: {
  id: string;
  integrationId: string;
  direction: string;
  operation: string;
  status: string;
  attempt: number;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
}): IntegrationDeliverySummary {
  return {
    id: row.id,
    integrationId: row.integrationId,
    direction: row.direction as IntegrationDeliverySummary['direction'],
    operation: row.operation,
    status: row.status as IntegrationDeliverySummary['status'],
    attempt: row.attempt,
    error: row.error,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  };
}
