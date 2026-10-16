import type {
  WorkflowDefinitionSummary,
  WorkflowInstanceStatus,
  WorkflowInstanceSummary,
  WorkflowTaskDecision,
  WorkflowTaskStatus,
  WorkflowTaskSummary,
  WorkflowVersionSummary,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

/**
 * The workflow engine's browser client.
 *
 * Every path here maps to a controller in `apps/api/src/modules/workflows`, so an
 * endpoint renamed on the server is a compile-time lookup away rather than a string a
 * reader has to trust. The engine owns authorisation: a task may only be decided by
 * someone the step's permission and the approval-authority rules admit, so the screen's
 * only job is to offer the buttons the caller's task status allows.
 */

/** A definition together with the versions that describe it. */
export interface WorkflowDefinitionDetail {
  readonly definition: WorkflowDefinitionSummary;
  readonly versions: readonly WorkflowVersionSummary[];
}

/** The draft input for a new definition. */
export interface CreateWorkflowDefinitionInput {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
}

/** The array bodies that make up one version of a definition. */
export interface WorkflowVersionBody {
  readonly states: readonly Record<string, unknown>[];
  readonly transitions: readonly Record<string, unknown>[];
  readonly steps?: readonly Record<string, unknown>[];
}

const query = (params: Readonly<Record<string, string | undefined>>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value.length > 0) {
      search.set(key, value);
    }
  }
  const rendered = search.toString();
  return rendered.length === 0 ? '' : `?${rendered}`;
};

export const workflowApi = {
  // My approvals -------------------------------------------------------------
  /** Tasks assigned to the signed-in user. `workflow:approve` gates the route. */
  myTasks: (status?: WorkflowTaskStatus): Promise<readonly WorkflowTaskSummary[]> =>
    apiRequestV1<readonly WorkflowTaskSummary[]>(
      `/workflow-tasks/mine${query({ status: status ?? undefined })}`,
    ),
  claimTask: (id: string): Promise<WorkflowTaskSummary> =>
    apiRequestV1<WorkflowTaskSummary>(`/workflow-tasks/${encodeURIComponent(id)}/claim`, {
      method: 'POST',
    }),
  decideTask: (
    id: string,
    decision: WorkflowTaskDecision,
    comment?: string,
  ): Promise<WorkflowInstanceSummary> =>
    apiRequestV1<WorkflowInstanceSummary>(`/workflow-tasks/${encodeURIComponent(id)}/decisions`, {
      method: 'POST',
      body: { decision, ...(comment === undefined ? {} : { comment }) },
    }),

  // Definitions --------------------------------------------------------------
  listDefinitions: (): Promise<readonly WorkflowDefinitionSummary[]> =>
    apiRequestV1<readonly WorkflowDefinitionSummary[]>('/workflows'),

  getDefinition: (id: string): Promise<WorkflowDefinitionDetail> =>
    apiRequestV1<WorkflowDefinitionDetail>(`/workflows/${encodeURIComponent(id)}`),

  createDefinition: (input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinitionSummary> =>
    apiRequestV1<WorkflowDefinitionSummary>('/workflows', { method: 'POST', body: input }),

  createVersion: (definitionId: string): Promise<WorkflowVersionSummary> =>
    apiRequestV1<WorkflowVersionSummary>(
      `/workflows/${encodeURIComponent(definitionId)}/versions`,
      { method: 'POST' },
    ),

  updateVersion: (
    definitionId: string,
    version: number,
    body: WorkflowVersionBody,
  ): Promise<WorkflowVersionSummary> =>
    apiRequestV1<WorkflowVersionSummary>(
      `/workflows/${encodeURIComponent(definitionId)}/versions/${version}`,
      { method: 'PUT', body },
    ),

  publishVersion: (definitionId: string, version: number): Promise<WorkflowVersionSummary> =>
    apiRequestV1<WorkflowVersionSummary>(
      `/workflows/${encodeURIComponent(definitionId)}/versions/${version}/publish`,
      { method: 'POST' },
    ),

  // Execution history --------------------------------------------------------
  listInstances: (
    filter: {
      readonly definitionId?: string;
      readonly status?: WorkflowInstanceStatus;
    } = {},
  ): Promise<readonly WorkflowInstanceSummary[]> =>
    apiRequestV1<readonly WorkflowInstanceSummary[]>(
      `/workflow-instances${query({ definitionId: filter.definitionId, status: filter.status })}`,
    ),

  getInstance: (id: string): Promise<WorkflowInstanceDetailResponse> =>
    apiRequestV1<WorkflowInstanceDetailResponse>(`/workflow-instances/${encodeURIComponent(id)}`),
};

/** An instance with the tasks and transition events that surround it. */
export interface WorkflowInstanceDetailResponse {
  readonly instance: WorkflowInstanceSummary;
  readonly tasks: readonly WorkflowTaskSummary[];
  readonly history: readonly WorkflowInstanceTransition[];
}

/** One executed transition. Mirrors the API's `WorkflowTransitionEventSummary`. */
export interface WorkflowInstanceTransition {
  readonly id: string;
  readonly fromStateKey: string | null;
  readonly toStateKey: string;
  readonly transitionName: string;
  readonly actorUserId: string;
  readonly comment: string | null;
  readonly createdAt: string;
}

export type { WorkflowTaskDecision };
