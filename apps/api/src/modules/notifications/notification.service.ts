import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  LOG_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EMAIL_EVENTS,
  NOTIFICATION_EVENT_KEYS,
  NOTIFICATION_EVENT_KINDS,
  NOTIFICATION_TEMPLATE_DEFAULTS,
  NOTIFICATION_EMAIL_JOB,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationEmailJob,
  type NotificationEventKey,
  type NotificationKind,
  type NotificationPreferenceReadModel,
  type NotificationReadModel,
  type NotificationTemplateReadModel,
} from '@hris/shared-types';

import { ValidationError } from '../../common/errors/app-error';
import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service';
import { SettingsService } from '../settings/settings.service';

/**
 * The value sent to the notification queue for one email delivery. The message is
 * rendered here because the trigger's metadata is not persisted; the worker
 * (`apps/worker`) only needs the recipient and the finished content, plus the id
 * so it can write the delivery outcome back. The shape is shared with the worker.
 */
export type NotificationEmailDelivery = NotificationEmailJob;

export interface NotificationEmitInput {
  readonly eventKey: NotificationEventKey;
  /** The recipient. Must belong to the same company as the emitter. */
  readonly userId: string;
  /** Overrides the rendered template title when provided. */
  readonly title?: string;
  /** Overrides the rendered template description when provided. */
  readonly description?: string;
  /** Deep link surfaced in the UI and email body. */
  readonly href?: string;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
}

interface TemplateRow {
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
}

type DbNotificationKind = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

const DEFAULT_CHANNEL_ENABLED: Readonly<Record<NotificationChannel, boolean>> = {
  IN_APP: true,
  EMAIL: true,
  PUSH: false,
};

const CHANNEL_SETTING_KEY: Readonly<Record<NotificationChannel, string>> = {
  IN_APP: 'notification.inApp.enabled',
  EMAIL: 'notification.email.enabled',
  PUSH: 'notification.push.enabled',
};

const KIND_TO_DB: Readonly<Record<NotificationKind, DbNotificationKind>> = {
  info: 'INFO',
  success: 'SUCCESS',
  warning: 'WARNING',
  error: 'ERROR',
};

const DB_KIND_TO_KIND: Readonly<Record<DbNotificationKind, NotificationKind>> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

/**
 * Notification platform (System -> Communication).
 *
 * Emitting business events through {@link emit} is the supported path: it resolves
 * the recipient's effective channel toggles from company settings and per-user
 * preferences, renders the message from the per-event templates, persists the
 * in-app delivery immediately and hands email delivery to the background worker
 * through the notifications queue.
 *
 * Reads are recipient-scoped (a user sees exactly their own notifications), while
 * template maintenance is admin-scoped and company-scoped.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
  ) {}

  /**
   * Persists one business event for one recipient and returns the delivered rows.
   *
   * Kept deliberately small: business modules call it after the state change that
   * triggers the event, never before, so a notification never claims something
   * that was rolled back.
   */
  async emit(
    companyId: string,
    actorUserId: string | null,
    input: NotificationEmitInput,
  ): Promise<NotificationReadModel[]> {
    if (!(NOTIFICATION_EVENT_KEYS as readonly string[]).includes(input.eventKey)) {
      throw new ValidationError(`Unknown notification event "${input.eventKey}".`);
    }

    const client = this.prisma.getClient();
    const deliverable = await withTenantContext(client, companyId, async (tx) => {
      const recipient = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });
      if (!recipient) {
        throw new ValidationError(`Recipient user "${input.userId}" does not exist.`);
      }
      return { recipient };
    });

    const channels = await this.resolveActiveChannels(companyId, deliverable.recipient.id);
    const recipientEmail = deliverable.recipient.email;
    const targetChannels = channels.filter((channel) => {
      if (channel !== 'EMAIL') {
        return true;
      }
      return recipientEmail !== null && NOTIFICATION_EMAIL_EVENTS.has(input.eventKey);
    });

    if (targetChannels.length === 0) {
      // Everything the recipient opted out of; nothing to persist or send.
      return [];
    }

    const context = {
      appName:
        (await this.settings.getEffectiveSetting(companyId, 'general.company.displayName')) ??
        'HRIS',
      appUrl: this.config.secrets.externalBaseUrl ?? 'http://localhost:3000',
      ...input.metadata,
    } as Record<string, unknown>;

    const kind: NotificationKind = NOTIFICATION_EVENT_KINDS[input.eventKey];
    const created: NotificationReadModel[] = [];

    await withTenantContext(client, companyId, async (tx) => {
      for (const channel of targetChannels) {
        const message = input.title
          ? { title: input.title, description: input.description ?? '' }
          : await this.renderMessage(companyId, channel, input.eventKey, context);

        const row = await tx.notification.create({
          data: {
            companyId,
            userId: input.userId,
            kind: KIND_TO_DB[kind],
            eventKey: input.eventKey,
            title: message.title,
            description: message.description,
            href: input.href ?? null,
            channel,
            deliveryStatus: channel === 'EMAIL' ? 'PENDING' : 'DELIVERED',
            correlationId: input.correlationId ?? null,
            createdBy: actorUserId ?? undefined,
          },
        });

        created.push(toReadModel(row));

        if (channel === 'EMAIL') {
          await this.enqueueEmail(tx, {
            companyId,
            notificationId: row.id,
            recipientUserId: input.userId,
            to: recipientEmail ?? '',
            subject: message.title,
            body: message.description,
            appName: context.appName as string,
          });
        }
      }
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: LOG_EVENT_TYPES['notification.emitted'],
      actorUserId: actorUserId ?? undefined,
      resource: 'notification',
      resourceId: input.eventKey,
      status: 'SUCCESS',
      metadata: { recipientUserId: input.userId, channels: targetChannels },
    });

    return created;
  }

  /** The authenticated user's notifications, newest first. */
  async list(
    companyId: string,
    userId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<readonly NotificationReadModel[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.notification.findMany({
        where: {
          companyId,
          userId,
          ...(pagination.cursor ? { id: { lt: pagination.cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
      }),
    );
    return rows.map(toReadModel);
  }

  async unreadCount(companyId: string, userId: string): Promise<number> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, (tx) =>
      tx.notification.count({
        where: { companyId, userId, readAt: null },
      }),
    );
  }

  async markRead(companyId: string, userId: string, id: string): Promise<NotificationReadModel> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.notification.findFirst({
        where: { companyId, userId, id },
      });
      if (!row) {
        throw new ValidationError(`Notification "${id}" does not exist.`);
      }
      const updated = await tx.notification.update({
        where: { id },
        data: { readAt: row.readAt ?? new Date(), deliveryStatus: 'READ' },
      });
      return toReadModel(updated);
    });
  }

  /** Marks every unread item read and returns the count that flipped. */
  async markAllRead(companyId: string, userId: string): Promise<{ readonly marked: number }> {
    const client = this.prisma.getClient();
    const marked = await withTenantContext(client, companyId, async (tx) => {
      const unread = await tx.notification.count({ where: { companyId, userId, readAt: null } });
      if (unread > 0) {
        await tx.notification.updateMany({
          where: { companyId, userId, readAt: null },
          data: { readAt: new Date(), deliveryStatus: 'READ' },
        });
      }
      return unread;
    });
    return { marked };
  }

  // ---------------------------------------------------------------------------
  // Recipient preferences
  // ---------------------------------------------------------------------------

  async listPreferences(
    companyId: string,
    userId: string,
  ): Promise<NotificationPreferenceReadModel[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.notificationPreference.findMany({ where: { companyId, userId } }),
    );
    // Present a complete vocabulary: an absent row is the shared "default true"
    // toggle, so the settings screen renders every channel regardless of DB rows.
    const byChannel = new Map(rows.map((row) => [row.channel as NotificationChannel, row]));
    return NOTIFICATION_CHANNELS.map((channel) => ({
      channel,
      eventKey: null,
      enabled: byChannel.get(channel)?.enabled ?? DEFAULT_CHANNEL_ENABLED[channel],
    }));
  }

  async updatePreferences(
    companyId: string,
    userId: string,
    items: readonly { readonly channel: NotificationChannel; readonly enabled: boolean }[],
  ): Promise<NotificationPreferenceReadModel[]> {
    for (const item of items) {
      if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(item.channel)) {
        throw new ValidationError(`Unknown channel "${item.channel}".`);
      }
    }

    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      for (const item of items) {
        const stored = await tx.notificationPreference.upsert({
          where: {
            companyId_userId_channel: { companyId, userId, channel: item.channel },
          },
          create: { companyId, userId, channel: item.channel, enabled: item.enabled },
          update: { enabled: item.enabled },
        });
        void stored;
      }
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: LOG_EVENT_TYPES['notification.channels_updated'],
      actorUserId: userId,
      resource: 'notification',
      resourceId: 'preferences',
      status: 'SUCCESS',
      metadata: { toggles: items },
    });

    return this.listPreferences(companyId, userId);
  }

  // ---------------------------------------------------------------------------
  // Templates (admin, company-scoped)
  // ---------------------------------------------------------------------------

  async listTemplates(companyId: string): Promise<NotificationTemplateReadModel[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.notificationTemplate.findMany({
        where: {},
        orderBy: [{ eventKey: 'asc' }, { channel: 'asc' }],
      }),
    );
    return rows.map((row) => toTemplateModel(row));
  }

  /** Creates or overwrites one event/channel template. */
  async updateTemplate(
    companyId: string,
    actorUserId: string,
    eventKey: NotificationEventKey,
    channel: NotificationChannel,
    input: {
      readonly subjectTemplate: string;
      readonly bodyTemplate: string;
      readonly enabled: boolean;
    },
  ): Promise<NotificationTemplateReadModel> {
    if (!(NOTIFICATION_EVENT_KEYS as readonly string[]).includes(eventKey)) {
      throw new ValidationError(`Unknown notification event "${eventKey}".`);
    }
    if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(channel)) {
      throw new ValidationError(`Unknown channel "${channel}".`);
    }
    if (input.subjectTemplate.trim() === '' || input.bodyTemplate.trim() === '') {
      throw new ValidationError('Template subject and body must not be blank.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, (tx) =>
      tx.notificationTemplate.upsert({
        where: {
          companyId_eventKey_channel: { companyId, eventKey, channel },
        },
        create: {
          companyId,
          eventKey,
          channel,
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate,
          enabled: input.enabled,
          createdBy: actorUserId,
        },
        update: {
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate,
          enabled: input.enabled,
          createdBy: actorUserId,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: LOG_EVENT_TYPES['notification.template_updated'],
      actorUserId,
      resource: 'notification-template',
      resourceId: `${eventKey}:${channel}`,
      status: 'SUCCESS',
    });

    return toTemplateModel(row);
  }

  /** Provisions the catalogue defaults for a company, called by settings seeding. */
  async provisionDefaults(companyId: string, actorUserId: string | null): Promise<number> {
    const client = this.prisma.getClient();
    let created = 0;

    await withTenantContext(client, companyId, async (tx) => {
      for (const eventKey of NOTIFICATION_EVENT_KEYS) {
        for (const channel of NOTIFICATION_CHANNELS) {
          if (channel === 'PUSH') {
            continue;
          }
          const defaults = NOTIFICATION_TEMPLATE_DEFAULTS[eventKey][channel];
          const existing = await tx.notificationTemplate.findFirst({
            where: { companyId, eventKey, channel },
          });
          if (existing) {
            continue;
          }
          await tx.notificationTemplate.create({
            data: {
              companyId,
              eventKey,
              channel,
              subjectTemplate: defaults.subjectTemplate,
              bodyTemplate: defaults.bodyTemplate,
              enabled: true,
              createdBy: actorUserId ?? undefined,
            },
          });
          created += 1;
        }
      }
    });

    return created;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** The channels the recipient sees, combining company and per-user toggles. */
  private async resolveActiveChannels(
    companyId: string,
    userId: string,
  ): Promise<NotificationChannel[]> {
    const client = this.prisma.getClient();
    const prefs = await withTenantContext(client, companyId, (tx) =>
      tx.notificationPreference.findMany({ where: { companyId, userId } }),
    );
    const userEnabled = new Map<NotificationChannel, boolean>(
      prefs.map((row) => [row.channel as NotificationChannel, row.enabled]),
    );

    const active: NotificationChannel[] = [];
    for (const channel of NOTIFICATION_CHANNELS) {
      const companyEnabled = Boolean(
        (await this.settings.getEffectiveSetting(companyId, CHANNEL_SETTING_KEY[channel])) ??
        DEFAULT_CHANNEL_ENABLED[channel],
      );
      const personalEnabled = userEnabled.get(channel) ?? DEFAULT_CHANNEL_ENABLED[channel];
      if (companyEnabled && personalEnabled) {
        active.push(channel);
      }
    }
    return active;
  }

  /** Renders the subject and body for an event, preferring stored templates. */
  private async renderMessage(
    companyId: string,
    channel: NotificationChannel,
    eventKey: NotificationEventKey,
    context: Record<string, unknown>,
  ): Promise<{ readonly title: string; readonly description: string }> {
    const template = await this.loadTemplate(companyId, eventKey, channel);
    return {
      title: substitute(template.subjectTemplate, context),
      description: substitute(template.bodyTemplate, context),
    };
  }

  private async loadTemplate(
    companyId: string,
    eventKey: NotificationEventKey,
    channel: NotificationChannel,
  ): Promise<TemplateRow> {
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, (tx) =>
      tx.notificationTemplate.findFirst({
        where: { companyId, eventKey, channel },
        select: { subjectTemplate: true, bodyTemplate: true, enabled: true },
      }),
    );
    if (row && row.enabled) {
      return { subjectTemplate: row.subjectTemplate, bodyTemplate: row.bodyTemplate };
    }
    return NOTIFICATION_TEMPLATE_DEFAULTS[eventKey][channel];
  }

  /** Enqueues an email delivery job so rendering never blocks the request. */
  private async enqueueEmail(
    tx: Prisma.TransactionClient,
    delivery: NotificationEmailDelivery,
  ): Promise<void> {
    if (!this.config.redis || !this.queue.isConfigured || delivery.to === '') {
      await tx.notification.update({
        where: { id: delivery.notificationId },
        data: { deliveryStatus: 'FAILED' },
      });
      return;
    }
    await this.queue
      .getQueue(QUEUE_NAMES.NOTIFICATIONS)
      .add(NOTIFICATION_EMAIL_JOB, delivery satisfies NotificationEmailJob);
  }
}

function toReadModel(row: {
  id: string;
  kind: DbNotificationKind;
  eventKey: string;
  title: string;
  description: string;
  href: string | null;
  channel: NotificationChannel;
  deliveryStatus: NotificationDeliveryStatus;
  readAt: Date | null;
  createdAt: Date;
}): NotificationReadModel {
  return {
    id: row.id,
    kind: DB_KIND_TO_KIND[row.kind],
    eventKey: row.eventKey,
    title: row.title,
    description: row.description,
    href: row.href,
    channel: row.channel,
    deliveryStatus: row.deliveryStatus,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTemplateModel(row: {
  id: string;
  eventKey: string;
  channel: NotificationChannel;
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
}): NotificationTemplateReadModel {
  return {
    id: row.id,
    eventKey: row.eventKey as NotificationEventKey,
    channel: row.channel,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    enabled: row.enabled,
  };
}

/** Replaces `{{key}}` placeholders from the template context. */
export function substitute(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) => {
    const value = context[key];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}
