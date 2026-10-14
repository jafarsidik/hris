/**
 * Notification vocabulary shared by the API and the notification surfaces.
 *
 * The bell, the Notifications page and the admin template/preference screens all
 * derive their shapes from this module, so a change to the event registry or the
 * read model cannot get out of step with the server that produces them.
 */

import type { NotificationChannel, NotificationDeliveryStatus } from './workflow.types';

/**
 * Stable event keys the platform can emit. Each key maps to a template per channel,
 * so renaming one silently strands the templates that reference it.
 */
export const NOTIFICATION_EVENT_KEYS = [
  'user.welcome',
  'user.invited',
  'user.password_changed',
  'user.security_alert',
  'role.changed',
  'settings.changed',
  'workflow.task_assigned',
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENT_KEYS)[number];

/** Tonality used by the UI to colour an item; distinct from the delivery state. */
export const NOTIFICATION_KINDS = ['info', 'success', 'warning', 'error'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The kind each event renders as, so the seed and the emitter cannot disagree. */
export const NOTIFICATION_EVENT_KINDS: Readonly<Record<NotificationEventKey, NotificationKind>> = {
  'user.welcome': 'success',
  'user.invited': 'info',
  'user.password_changed': 'info',
  'user.security_alert': 'error',
  'role.changed': 'warning',
  'settings.changed': 'info',
  'workflow.task_assigned': 'info',
};

/**
 * A per-channel message template. `{{name}}` placeholders are substituted
 * server-side from the event's metadata before delivery.
 */
export interface NotificationTemplateDefault {
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
}

/**
 * The messages the platform starts each company with, catalogued here so the
 * seed and the runtime fallback render identical copy. Companies edit these
 * through the template admin surface, which persists to
 * `notification_templates`; a fresh company always begins with these.
 */
export const NOTIFICATION_TEMPLATE_DEFAULTS: Readonly<
  Record<NotificationEventKey, Readonly<Record<NotificationChannel, NotificationTemplateDefault>>>
> = {
  'user.welcome': {
    IN_APP: {
      subjectTemplate: 'Welcome to {{appName}}',
      bodyTemplate: 'Your account has been activated. Welcome aboard!',
    },
    EMAIL: {
      subjectTemplate: 'Welcome to {{appName}}',
      bodyTemplate: 'Your account has been activated. Sign in to get started: {{appUrl}}',
    },
    PUSH: {
      subjectTemplate: 'Welcome to {{appName}}',
      bodyTemplate: 'Your account has been activated.',
    },
  },
  'user.invited': {
    IN_APP: {
      subjectTemplate: 'You have been invited',
      bodyTemplate: '{{invitedBy}} invited you to join {{appName}}.',
    },
    EMAIL: {
      subjectTemplate: 'You have been invited to {{appName}}',
      bodyTemplate:
        '{{invitedBy}} invited you to join {{appName}}. Accept your invitation at {{appUrl}}',
    },
    PUSH: {
      subjectTemplate: 'You have been invited',
      bodyTemplate: '{{invitedBy}} invited you to join {{appName}}.',
    },
  },
  'user.password_changed': {
    IN_APP: {
      subjectTemplate: 'Password changed',
      bodyTemplate:
        'Your password was changed. If this was not you, contact your administrator immediately.',
    },
    EMAIL: {
      subjectTemplate: 'Your {{appName}} password was changed',
      bodyTemplate:
        'Your {{appName}} password was changed. If this was not you, contact your administrator and review your active sessions at {{appUrl}}',
    },
    PUSH: { subjectTemplate: 'Password changed', bodyTemplate: 'Your password was changed.' },
  },
  'user.security_alert': {
    IN_APP: { subjectTemplate: 'Security alert', bodyTemplate: '{{detail}}' },
    EMAIL: {
      subjectTemplate: 'Security alert on your {{appName}} account',
      bodyTemplate: '{{detail}}\n\nSign in at {{appUrl}} to review.',
    },
    PUSH: { subjectTemplate: 'Security alert', bodyTemplate: '{{detail}}' },
  },
  'role.changed': {
    IN_APP: {
      subjectTemplate: 'Your role changed',
      bodyTemplate: 'Your access role was changed {{actorName}}.',
    },
    EMAIL: {
      subjectTemplate: 'Your access role changed',
      bodyTemplate:
        'Your {{appName}} access role was changed {{actorName}}. Contact your administrator if you did not request this.',
    },
    PUSH: { subjectTemplate: 'Your role changed', bodyTemplate: 'Your access role was changed.' },
  },
  'settings.changed': {
    IN_APP: { subjectTemplate: 'Settings updated', bodyTemplate: '{{detail}}' },
    EMAIL: { subjectTemplate: 'Settings updated', bodyTemplate: '{{detail}}' },
    PUSH: { subjectTemplate: 'Settings updated', bodyTemplate: '{{detail}}' },
  },
  'workflow.task_assigned': {
    IN_APP: { subjectTemplate: 'Approval required', bodyTemplate: '{{detail}}' },
    EMAIL: {
      subjectTemplate: 'Approval required',
      bodyTemplate: '{{detail}}\n\nOpen the task at {{appUrl}}',
    },
    PUSH: { subjectTemplate: 'Approval required', bodyTemplate: '{{detail}}' },
  },
};

/** Whether an event is eligible for email delivery, applied for the EMAIL channel. */
export const NOTIFICATION_EMAIL_EVENTS: ReadonlySet<NotificationEventKey> = new Set([
  'user.welcome',
  'user.invited',
  'user.password_changed',
  'user.security_alert',
  'role.changed',
  'workflow.task_assigned',
]);

/** A notification as served to a client. `href` is null when nothing is reachable. */
export interface NotificationReadModel {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly eventKey: string;
  readonly title: string;
  readonly description: string;
  readonly href: string | null;
  readonly channel: NotificationChannel;
  readonly deliveryStatus: NotificationDeliveryStatus;
  readonly readAt: string | null;
  readonly createdAt: string;
}

/**
 * A single channel toggle for a recipient. A null `eventKey` is the default that
 * applies to every event the channel-specific rows do not override.
 */
export interface NotificationPreferenceReadModel {
  readonly channel: NotificationChannel;
  readonly eventKey: string | null;
  readonly enabled: boolean;
}

/** A per-event, per-channel message template rendered server-side. */
export interface NotificationTemplateReadModel {
  readonly id: string;
  readonly eventKey: NotificationEventKey;
  readonly channel: NotificationChannel;
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
  readonly enabled: boolean;
}
