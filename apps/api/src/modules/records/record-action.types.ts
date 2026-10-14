import type { Prisma } from '@hris/database';

import type { SessionPrincipal } from '../../common/auth/permission.service';

/** The record a custom action runs against, as the plumbing projects it. */
export interface RecordActionRecord {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly unitId: string | null;
}

/** Everything a {@link RecordActionDefinition} handler receives. */
export interface RecordActionContext {
  /** The tenant transaction the action runs in; a patch is persisted by the plumbing. */
  readonly tx: Prisma.TransactionClient;
  readonly companyId: string;
  readonly principal: SessionPrincipal;
  readonly resourceKey: string;
  readonly record: RecordActionRecord;
  /** The request body (already checked to be a JSON object). */
  readonly input: Record<string, unknown>;
}

/** A fact a handler asks the bus to deliver after the transaction commits. */
export interface RecordActionEvent {
  readonly type: string;
  readonly payload?: Record<string, unknown>;
}

/** The result of a handler. Every field is optional. */
export interface RecordActionOutcome {
  /** Field patch merged into the record and persisted by the plumbing. */
  readonly patch?: Record<string, unknown>;
  /** Domain events dispatched after the transaction commits. */
  readonly events?: readonly RecordActionEvent[];
  /** Arbitrary value returned to the caller alongside the updated record. */
  readonly result?: unknown;
}

/**
 * A custom action a registered resource can perform.
 *
 * `permission` must be a real `resource.action` grant (for example `task.update`):
 * a custom action is registered metadata, not a member of the `Action` enum, so it
 * reuses a standard permission rather than inventing one that cannot be granted.
 */
export interface RecordActionDefinition {
  readonly permission: string;
  handle(context: RecordActionContext): Promise<RecordActionOutcome>;
}
