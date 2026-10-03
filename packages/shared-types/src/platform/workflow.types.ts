/**
 * Workflow and notification vocabulary.
 *
 * Business modules must delegate approval routing to the workflow engine and
 * never implement their own approval chain (ARCHITECTURE section 12).
 */

export const WORKFLOW_INSTANCE_STATUSES = [
  'IN_PROGRESS',
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
