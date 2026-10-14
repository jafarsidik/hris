/**
 * Workflow and notification vocabulary.
 *
 * Business modules must delegate approval routing to the workflow engine and
 * never implement their own approval chain (ARCHITECTURE section 12).
 */

export const WORKFLOW_INSTANCE_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export type WorkflowInstanceStatus = (typeof WORKFLOW_INSTANCE_STATUSES)[number];

export const WORKFLOW_TASK_STATUSES = [
  'PENDING',
  'CLAIMED',
  'APPROVED',
  'REJECTED',
  'SKIPPED',
  'ESCALATED',
  'EXPIRED',
] as const;

export type WorkflowTaskStatus = (typeof WORKFLOW_TASK_STATUSES)[number];

/** How a step decides whether it applies to a given workflow instance. */
export const WORKFLOW_STEP_TYPES = ['SEQUENTIAL', 'PARALLEL', 'CONDITIONAL'] as const;

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

/** The lifecycle of a workflow version. Only the `ACTIVE` version runs new instances. */
export const WORKFLOW_VERSION_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

export type WorkflowVersionStatus = (typeof WORKFLOW_VERSION_STATUSES)[number];

/** A state in a workflow version's state machine. */
export interface WorkflowStateDefinition {
  readonly key: string;
  readonly name: string;
  readonly isInitial: boolean;
  readonly isFinal: boolean;
  readonly sortOrder: number;
}

/** A named transition between two states of the same workflow version. */
export interface WorkflowTransitionDefinition {
  readonly name: string;
  readonly fromStateKey: string;
  readonly toStateKey: string;
  readonly requiredPermission: string | null;
  readonly requiresApproval: boolean;
  readonly sortOrder: number;
}

/** A workflow definition with its latest version facts, for list/detail screens. */
export interface WorkflowDefinitionSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly activeVersion: number | null;
  readonly draftVersion: number | null;
}

/** A single version of a workflow definition. */
export interface WorkflowVersionSummary {
  readonly id: string;
  readonly version: number;
  readonly status: WorkflowVersionStatus;
  readonly states: readonly WorkflowStateDefinition[];
  readonly transitions: readonly WorkflowTransitionDefinition[];
  readonly publishedAt: string | null;
  readonly createdAt: string;
}

/** A running instance of a workflow. */
export interface WorkflowInstanceSummary {
  readonly id: string;
  readonly definitionId: string;
  readonly version: number;
  readonly resource: string | null;
  readonly resourceId: string | null;
  readonly currentStateKey: string;
  readonly status: WorkflowInstanceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One executed transition, forming the instance's audit trail. */
export interface WorkflowTransitionEventSummary {
  readonly id: string;
  readonly fromStateKey: string | null;
  readonly toStateKey: string;
  readonly transitionName: string;
  readonly actorUserId: string;
  readonly comment: string | null;
  readonly createdAt: string;
}

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'PUSH'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'SUPPRESSED',
] as const;

export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

/** Mobile offline sync states (ARCHITECTURE section 19). The server stays authoritative. */
export const SYNC_STATES = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT'] as const;

export type SyncState = (typeof SYNC_STATES)[number];

/**
 * Operations a mobile client may capture while offline.
 *
 * Approval decisions are included deliberately: letting an approver act offline
 * is a requirement, and the server validates the decision against the workflow
 * state it holds rather than trusting the client.
 */
export const OFFLINE_OPERATION_TYPES = [
  'ATTENDANCE_CHECK_IN',
  'ATTENDANCE_CHECK_OUT',
  'ATTENDANCE_CORRECTION_REQUEST',
  'LEAVE_REQUEST',
  'LEAVE_CANCELLATION',
  'CLAIM_SUBMISSION',
  'APPROVAL_DECISION',
] as const;

export type OfflineOperationType = (typeof OFFLINE_OPERATION_TYPES)[number];
