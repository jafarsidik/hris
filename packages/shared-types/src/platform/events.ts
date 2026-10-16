/**
 * Domain-event vocabulary shared by the API, the worker and the web tier.
 *
 * The catalogue is the contract for automation: a business rule, a webhook subscription
 * and the Event Registry all name reactions by the same dot-separated `type`. The list
 * lives here rather than in the API so the web tier can render it without a round trip
 * and a rename cannot leave one side pointing at a type the other never emits.
 */

/** The broad family an event belongs to, used only for grouping in the registry. */
export const EVENT_CATEGORIES = [
  'WORKFLOW',
  'RECORDS',
  'IDENTITY',
  'INTEGRATION',
  'SYSTEM',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** One reactive event type: what a rule, workflow or webhook may subscribe to. */
export interface EventTypeDefinition {
  /** The stable, dot-separated name, e.g. `task.completed`. */
  readonly type: string;
  readonly category: EventCategory;
  /** The resource the fact concerns, e.g. `task`. */
  readonly resource: string;
  readonly description: string;
}

/**
 * Every event type the platform emits.
 *
 * Kept deliberately small and factual: each entry names an event a producer actually
 * emits, so "subscribe to it" is advice that works. `packages/shared-types` is the one
 * place both processes agree on the strings.
 */
export const EVENT_TYPE_CATALOGUE: readonly EventTypeDefinition[] = [
  {
    type: 'record.created',
    category: 'RECORDS',
    resource: 'record',
    description: 'A record of a registered resource was created.',
  },
  {
    type: 'record.updated',
    category: 'RECORDS',
    resource: 'record',
    description: 'A record was updated, including through a custom action.',
  },
  {
    type: 'record.deleted',
    category: 'RECORDS',
    resource: 'record',
    description: 'A record was deleted.',
  },
  {
    type: 'task.completed',
    category: 'RECORDS',
    resource: 'task',
    description: 'A task record reached a completed state.',
  },
  {
    type: 'workflow.started',
    category: 'WORKFLOW',
    resource: 'workflow-instance',
    description: 'A workflow instance left its initial state.',
  },
  {
    type: 'workflow.task.completed',
    category: 'WORKFLOW',
    resource: 'workflow-task',
    description: 'An approver decided a workflow task.',
  },
  {
    type: 'workflow.completed',
    category: 'WORKFLOW',
    resource: 'workflow-instance',
    description: 'A workflow instance reached a final state.',
  },
  {
    type: 'user.created',
    category: 'IDENTITY',
    resource: 'user',
    description: 'An employee account was provisioned.',
  },
  {
    type: 'integration.delivery.failed',
    category: 'INTEGRATION',
    resource: 'integration',
    description: 'A webhook delivery exhausted its attempts.',
  },
];

/** A persisted domain event as the Event Registry returns it. */
export interface OutboxEventSummary {
  readonly id: string;
  readonly type: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly actorUserId: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
  /** When every consumer last succeeded; null while a delivery is still owed. */
  readonly publishedAt: string | null;
  readonly attempts: number;
  readonly lastError: string | null;
}

/** The catalogue and the recent history, returned together by the registry endpoint. */
export interface EventRegistrySnapshot {
  readonly types: readonly EventTypeDefinition[];
  readonly recent: readonly OutboxEventSummary[];
  /** How many recent events are still awaiting a successful delivery. */
  readonly pending: number;
}
