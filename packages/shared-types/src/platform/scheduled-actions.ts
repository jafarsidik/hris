export const SCHEDULED_ACTION_ACTION_TYPES = ['START_WORKFLOW', 'NOTIFY', 'EMIT_EVENT'] as const;

export type ScheduledActionActionType = (typeof SCHEDULED_ACTION_ACTION_TYPES)[number];

export type ScheduledActionAction =
  | {
      readonly type: 'START_WORKFLOW';
      readonly definitionId: string;
      readonly resource?: string | null;
      readonly resourceId?: string | null;
    }
  | {
      readonly type: 'NOTIFY';
      readonly recipientUserId?: string;
      readonly title?: string;
      readonly description?: string;
      readonly href?: string;
    }
  | {
      readonly type: 'EMIT_EVENT';
      readonly eventType: string;
      readonly payload?: Record<string, unknown>;
    };

export interface ScheduledActionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly cron: string;
  readonly action: ScheduledActionAction;
  readonly isEnabled: boolean;
  readonly nextRunAt: string | null;
  readonly lastRunAt: string | null;
  readonly lastError: string | null;
}
