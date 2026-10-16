import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  parsePermissionKey,
  type WorkflowDefinitionSummary,
  type WorkflowInstanceStatus,
  type WorkflowInstanceSummary,
  type WorkflowStateDefinition,
  type WorkflowStepDefinition,
  type WorkflowTaskStatus,
  type WorkflowTransitionDefinition,
  type WorkflowTransitionEventSummary,
  type WorkflowVersionSummary,
  type WorkflowTaskSummary,
  type WorkflowSlaJob,
  WORKFLOW_SLA_JOB,
  WORKFLOW_STEP_DECISION_TYPES,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_TASK_DECISIONS,
} from '@hris/shared-types';

import { can } from '../../common/auth/authorization.guard';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { NotificationService } from '../notifications/notification.service';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service';

/** The caller attributes the workflow engine needs, drawn from the session principal. */
export interface WorkflowActor {
  readonly companyId: string;
  readonly userId: string;
  readonly permissions: SessionPrincipal['permissions'];
}

/** A state as accepted from the API (sortOrder is optional and defaulted on write). */
export interface StateInput {
  readonly key?: string;
  readonly name?: string;
  readonly isInitial?: boolean;
  readonly isFinal?: boolean;
  readonly sortOrder?: number;
}

/** A transition as accepted from the API. */
export interface TransitionInput {
  readonly name?: string;
  readonly fromStateKey?: string;
  readonly toStateKey?: string;
  readonly requiredPermission?: string | null;
  readonly requiresApproval?: boolean;
  readonly sortOrder?: number;
  readonly condition?: string | null;
}

export interface StepInput {
  readonly key?: string;
  readonly name?: string;
  readonly type?: string;
  readonly decisionType?: string;
  readonly requiredPermission?: string | null;
  readonly requiresApproval?: boolean;
  readonly sortOrder?: number;
  readonly predecessorKeys?: string[];
  readonly nextKeys?: string[];
  readonly condition?: string | null;
  readonly timeoutMinutes?: number | null;
  readonly escalationPolicy?: string | null;
  readonly stateKey?: string | null;
}

export interface StartInstanceInput {
  readonly definitionId?: string;
  readonly resource?: string | null;
  readonly resourceId?: string | null;
}

/** The permission a transition requires when it does not name one explicitly. */
export const DEFAULT_TRANSITION_PERMISSION = 'workflow.approve';

const STATE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const VERSION_INCLUDE = { version: { select: { version: true } } } as const;

type InstanceRow = Prisma.WorkflowInstanceGetPayload<{ include: typeof VERSION_INCLUDE }>;

/** The subset of instance facts the step router needs while it walks the graph. */
interface RoutingInstance {
  readonly id: string;
  readonly companyId: string;
  readonly versionId: string;
  readonly resource: string | null;
  readonly currentStateKey: string;
}

/**
 * The workflow engine.
 *
 * A definition is a stable key; each has immutable versions whose states and
 * transitions are stored as validated JSON. Publishing activates a version and archives
 * the previous one; running instances pin the version they started on, so a later
 * publish never rewrites a process already in flight. Every transition is checked
 * against the actor's live permissions and, when the transition demands one, against the
 * approval-authority rules before it is applied and appended to history.
 */
@Injectable()
export class WorkflowService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  // ---------------------------------------------------------------------------
  // Definitions
  // ---------------------------------------------------------------------------

  async listDefinitions(companyId: string): Promise<readonly WorkflowDefinitionSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const definitions = await tx.workflowDefinition.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { versions: { select: { version: true, status: true } } },
      });
      return definitions.map(toDefinitionSummary);
    });
  }

  async getDefinition(
    companyId: string,
    id: string,
  ): Promise<{
    definition: WorkflowDefinitionSummary;
    versions: readonly WorkflowVersionSummary[];
  }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const definition = await tx.workflowDefinition.findFirst({
        where: { id },
        include: { versions: { orderBy: { version: 'desc' } } },
      });
      if (definition === null) {
        throw new NotFoundError('The workflow definition does not exist.');
      }
      return {
        definition: toDefinitionSummary(definition),
        versions: definition.versions.map(toVersionSummary),
      };
    });
  }

  async createDefinition(
    actor: WorkflowActor,
    input: { key?: string; name?: string; description?: string | null },
  ): Promise<WorkflowDefinitionSummary> {
    const key = (input.key ?? '').trim().toLowerCase();
    const name = (input.name ?? '').trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
      throw new ValidationError(
        'The workflow key must start with a letter and contain only lower-case letters, digits and underscores.',
      );
    }
    if (name.length === 0 || name.length > 120) {
      throw new ValidationError(
        'The workflow name is required and must be at most 120 characters.',
      );
    }

    const client = this.prisma.getClient();
    const created = await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.workflowDefinition.findFirst({
        where: { key },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('A workflow with that key already exists.');
      }
      const definition = await tx.workflowDefinition.create({
        data: {
          companyId: actor.companyId,
          key,
          name,
          description: input.description ?? null,
          createdBy: actor.userId,
        },
      });
      await tx.workflowVersion.create({
        data: {
          companyId: actor.companyId,
          definitionId: definition.id,
          version: 1,
          status: 'DRAFT',
          states: [],
          transitions: [],
          createdBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.definition.create',
        resource: 'workflow',
        resourceId: definition.id,
        payload: { key },
      });
      return tx.workflowDefinition.findFirstOrThrow({
        where: { id: definition.id },
        include: { versions: { select: { version: true, status: true } } },
      });
    });

    return toDefinitionSummary(created);
  }

  async updateDefinition(
    actor: WorkflowActor,
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<WorkflowDefinitionSummary> {
    if (input.name !== undefined && (input.name.trim().length === 0 || input.name.length > 120)) {
      throw new ValidationError('The workflow name must be between 1 and 120 characters.');
    }

    const client = this.prisma.getClient();
    const updated = await withTenantContext(client, actor.companyId, async (tx) => {
      await this.findDefinitionOrThrow(tx, id);
      await tx.workflowDefinition.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          createdBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.definition.update',
        resource: 'workflow',
        resourceId: id,
      });
      return tx.workflowDefinition.findFirstOrThrow({
        where: { id },
        include: { versions: { select: { version: true, status: true } } },
      });
    });

    return toDefinitionSummary(updated);
  }

  async deleteDefinition(actor: WorkflowActor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      await this.findDefinitionOrThrow(tx, id);
      await tx.workflowDefinition.update({
        where: { id },
        data: { deletedAt: new Date(), createdBy: actor.userId },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.definition.delete',
        resource: 'workflow',
        resourceId: id,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Versions
  // ---------------------------------------------------------------------------

  async createVersion(actor: WorkflowActor, definitionId: string): Promise<WorkflowVersionSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      await this.findDefinitionOrThrow(tx, definitionId);
      const latest = await tx.workflowVersion.findFirst({
        where: { definitionId },
        orderBy: { version: 'desc' },
      });
      const created = await tx.workflowVersion.create({
        data: {
          companyId: actor.companyId,
          definitionId,
          version: (latest?.version ?? 0) + 1,
          status: 'DRAFT',
          states: (latest?.states ?? []) as never,
          transitions: (latest?.transitions ?? []) as never,
          steps: (latest?.steps ?? []) as never,
          createdBy: actor.userId,
        },
      });
      return toVersionSummary(created);
    });
  }

  async updateVersion(
    actor: WorkflowActor,
    definitionId: string,
    version: number,
    input: { states?: StateInput[]; transitions?: TransitionInput[]; steps?: StepInput[] },
  ): Promise<WorkflowVersionSummary> {
    const states = normalizeStates(input.states ?? []);
    const transitions = normalizeTransitions(input.transitions ?? [], states);
    const steps = normalizeSteps(input.steps ?? [], states);
    assertStateMachine(states, transitions);
    assertStepGraph(steps);

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.workflowVersion.findFirst({ where: { definitionId, version } });
      if (row === null) {
        throw new NotFoundError('The workflow version does not exist.');
      }
      if (row.status !== 'DRAFT') {
        throw new ConflictError('Only a draft version can be edited.');
      }
      const saved = await tx.workflowVersion.update({
        where: { id: row.id },
        data: {
          states: states as never,
          transitions: transitions as never,
          steps: steps as never,
          createdBy: actor.userId,
        },
      });
      return toVersionSummary(saved);
    });
  }

  async publishVersion(
    actor: WorkflowActor,
    definitionId: string,
    version: number,
  ): Promise<WorkflowVersionSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      await this.findDefinitionOrThrow(tx, definitionId);
      const row = await tx.workflowVersion.findFirst({ where: { definitionId, version } });
      if (row === null) {
        throw new NotFoundError('The workflow version does not exist.');
      }
      if (row.status === 'ARCHIVED') {
        throw new ConflictError('An archived version cannot be published again.');
      }
      const states = normalizeStates((row.states ?? []) as StateInput[]);
      const transitions = normalizeTransitions(
        (row.transitions ?? []) as TransitionInput[],
        states,
      );
      assertStateMachine(states, transitions);

      await tx.workflowVersion.updateMany({
        where: { definitionId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      const published = await tx.workflowVersion.update({
        where: { id: row.id },
        data: { status: 'ACTIVE', publishedAt: new Date(), createdBy: actor.userId },
      });

      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.version.publish',
        resource: 'workflow',
        resourceId: definitionId,
        payload: { version },
      });
      return toVersionSummary(published);
    });
  }

  // ---------------------------------------------------------------------------
  // Instances
  // ---------------------------------------------------------------------------

  async listInstances(
    companyId: string,
    filter: { definitionId?: string; status?: WorkflowInstanceStatus } = {},
  ): Promise<readonly WorkflowInstanceSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.workflowInstance.findMany({
        where: {
          ...(filter.definitionId === undefined ? {} : { definitionId: filter.definitionId }),
          ...(filter.status === undefined ? {} : { status: filter.status }),
        },
        include: VERSION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toInstanceSummary);
    });
  }

  async getInstance(
    companyId: string,
    id: string,
  ): Promise<{
    instance: WorkflowInstanceSummary;
    tasks: readonly WorkflowTaskSummary[];
    history: readonly WorkflowTransitionEventSummary[];
  }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const instance = await tx.workflowInstance.findFirst({
        where: { id },
        include: VERSION_INCLUDE,
      });
      if (instance === null) {
        throw new NotFoundError('The workflow instance does not exist.');
      }
      const [events, taskRows] = await Promise.all([
        tx.workflowTransitionEvent.findMany({
          where: { instanceId: id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.workflowTask.findMany({
          where: { instanceId: id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      ]);
      return {
        instance: toInstanceSummary(instance),
        tasks: taskRows.map(toTaskSummary),
        history: events.map(toEventSummary),
      };
    });
  }

  async startInstance(
    actor: WorkflowActor,
    input: StartInstanceInput,
  ): Promise<WorkflowInstanceSummary> {
    const definitionId = input.definitionId ?? '';
    if (definitionId.length === 0) {
      throw new ValidationError('A workflow definition is required to start an instance.');
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const definition = await this.findDefinitionOrThrow(tx, definitionId);
      const active = await tx.workflowVersion.findFirst({
        where: { definitionId, status: 'ACTIVE' },
      });
      if (active === null) {
        throw new ConflictError('The workflow has no published version to start.');
      }
      const states = readStates(active.states);
      const initial = states.find((state) => state.isInitial);
      if (initial === undefined) {
        throw new ConflictError('The active workflow version has no initial state.');
      }

      const steps = readSteps(active.steps);
      const hasSteps = steps.length > 0;

      const instance = await tx.workflowInstance.create({
        data: {
          companyId: actor.companyId,
          definitionId: definition.id,
          versionId: active.id,
          resource: input.resource ?? null,
          resourceId: input.resourceId ?? null,
          currentStateKey: initial.key,
          status: 'IN_PROGRESS',
          createdBy: actor.userId,
        },
        include: VERSION_INCLUDE,
      });
      await tx.workflowTransitionEvent.create({
        data: {
          companyId: actor.companyId,
          instanceId: instance.id,
          fromStateKey: null,
          toStateKey: initial.key,
          transitionName: 'START',
          actorUserId: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.instance.start',
        resource: 'workflow',
        resourceId: instance.id,
        payload: { definitionKey: definition.key },
      });

      if (hasSteps) {
        await this.enterInitialSteps(tx, actor, instance, states, steps);
        // Reload instance to get stepKey/dueAt/escalationAt
        const updated = await tx.workflowInstance.findFirstOrThrow({
          where: { id: instance.id },
          include: VERSION_INCLUDE,
        });
        return toInstanceSummary(updated);
      }

      return toInstanceSummary(instance);
    });
  }

  async executeTransition(
    actor: WorkflowActor,
    instanceId: string,
    input: { transition?: string; comment?: string | null },
  ): Promise<WorkflowInstanceSummary> {
    const transitionName = (input.transition ?? '').trim();
    if (transitionName.length === 0) {
      throw new ValidationError('A transition name is required.');
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const instance = await tx.workflowInstance.findFirst({
        where: { id: instanceId },
        include: VERSION_INCLUDE,
      });
      if (instance === null) {
        throw new NotFoundError('The workflow instance does not exist.');
      }
      if (instance.status !== 'IN_PROGRESS') {
        throw new ConflictError('The workflow instance is no longer in progress.');
      }

      const version = await tx.workflowVersion.findFirst({ where: { id: instance.versionId } });
      if (version === null) {
        throw new NotFoundError('The workflow version does not exist.');
      }
      const states = readStates(version.states);
      const transitions = readTransitions(version.transitions);
      const transition = transitions.find(
        (candidate) =>
          candidate.name === transitionName && candidate.fromStateKey === instance.currentStateKey,
      );
      if (transition === undefined) {
        throw new UnprocessableEntityError(
          `The transition "${transitionName}" is not available from the current state.`,
        );
      }

      await this.assertTransitionAllowed(tx, actor, instance.resource, transition);

      const target = states.find((state) => state.key === transition.toStateKey);
      if (target === undefined) {
        throw new UnprocessableEntityError('The transition targets an unknown state.');
      }

      const updated = await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          currentStateKey: target.key,
          status: target.isFinal ? 'COMPLETED' : 'IN_PROGRESS',
        },
        include: VERSION_INCLUDE,
      });
      await tx.workflowTransitionEvent.create({
        data: {
          companyId: actor.companyId,
          instanceId: instance.id,
          fromStateKey: instance.currentStateKey,
          toStateKey: target.key,
          transitionName,
          actorUserId: actor.userId,
          comment: input.comment ?? null,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.instance.transition',
        resource: 'workflow',
        resourceId: instance.id,
        payload: { transition: transitionName, to: target.key },
      });
      return toInstanceSummary(updated);
    });
  }

  async cancelInstance(actor: WorkflowActor, instanceId: string): Promise<WorkflowInstanceSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const instance = await tx.workflowInstance.findFirst({
        where: { id: instanceId },
        include: VERSION_INCLUDE,
      });
      if (instance === null) {
        throw new NotFoundError('The workflow instance does not exist.');
      }
      if (instance.status !== 'IN_PROGRESS') {
        throw new ConflictError('Only an in-progress instance can be cancelled.');
      }
      const updated = await tx.workflowInstance.update({
        where: { id: instance.id },
        data: { status: 'CANCELLED' },
        include: VERSION_INCLUDE,
      });
      await tx.workflowTransitionEvent.create({
        data: {
          companyId: actor.companyId,
          instanceId: instance.id,
          fromStateKey: instance.currentStateKey,
          toStateKey: instance.currentStateKey,
          transitionName: 'CANCEL',
          actorUserId: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.instance.cancel',
        resource: 'workflow',
        resourceId: instance.id,
      });
      return toInstanceSummary(updated);
    });
  }

  // ---------------------------------------------------------------------------
  // Tasks (step-driven routing, Phase 5.2a)
  // ---------------------------------------------------------------------------

  async listTasks(
    companyId: string,
    filter: { instanceId?: string; status?: WorkflowTaskStatus; assigneeUserId?: string } = {},
  ): Promise<readonly WorkflowTaskSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.workflowTask.findMany({
        where: {
          ...(filter.instanceId === undefined ? {} : { instanceId: filter.instanceId }),
          ...(filter.status === undefined ? {} : { status: filter.status }),
          ...(filter.assigneeUserId === undefined ? {} : { assigneeUserId: filter.assigneeUserId }),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toTaskSummary);
    });
  }

  async getTask(companyId: string, id: string): Promise<WorkflowTaskSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.workflowTask.findFirst({ where: { id } });
      if (row === null) {
        throw new NotFoundError('The workflow task does not exist.');
      }
      return toTaskSummary(row);
    });
  }

  async claimTask(actor: WorkflowActor, taskId: string): Promise<WorkflowTaskSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const task = await tx.workflowTask.findFirst({ where: { id: taskId } });
      if (task === null) {
        throw new NotFoundError('The workflow task does not exist.');
      }
      if (task.status !== 'PENDING') {
        throw new ConflictError('Only a pending task can be claimed.');
      }
      await this.assertStepPermission(tx, actor, task.stepKey, task.instanceId);

      const claimed = await tx.workflowTask.update({
        where: { id: taskId },
        data: { status: 'CLAIMED', assigneeUserId: actor.userId, claimedAt: new Date() },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.task.claim',
        resource: 'workflow',
        resourceId: taskId,
      });
      return toTaskSummary(claimed);
    });
  }

  async decideTask(
    actor: WorkflowActor,
    taskId: string,
    input: { decision?: string; comment?: string | null },
  ): Promise<WorkflowInstanceSummary> {
    const decision = String(input.decision ?? '').toUpperCase();
    if (!(WORKFLOW_TASK_DECISIONS as readonly string[]).includes(decision)) {
      throw new ValidationError('The decision must be APPROVE, REJECT or SKIP.');
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const task = await tx.workflowTask.findFirst({ where: { id: taskId } });
      if (task === null) {
        throw new NotFoundError('The workflow task does not exist.');
      }
      if (task.status !== 'PENDING' && task.status !== 'CLAIMED') {
        throw new ConflictError('The task has already been decided.');
      }
      const instance = await tx.workflowInstance.findFirst({
        where: { id: task.instanceId },
        include: VERSION_INCLUDE,
      });
      if (instance === null) {
        throw new NotFoundError('The workflow instance does not exist.');
      }
      if (instance.status !== 'IN_PROGRESS') {
        throw new ConflictError('The workflow instance is no longer in progress.');
      }
      const version = await tx.workflowVersion.findFirst({ where: { id: instance.versionId } });
      if (version === null) {
        throw new NotFoundError('The workflow version does not exist.');
      }
      const steps = readSteps(version.steps);
      const step = steps.find((candidate) => candidate.key === task.stepKey);
      if (step === undefined) {
        throw new UnprocessableEntityError('The task references an unknown step.');
      }

      await this.assertStepPermission(tx, actor, task.stepKey, instance.id, step);
      if (
        step.requiresApproval &&
        !(await this.isEffectiveApprover(tx, actor, instance.resource))
      ) {
        throw new ForbiddenError('You are not an authorized approver for this workflow.');
      }

      const status: WorkflowTaskStatus =
        decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'SKIPPED';
      await tx.workflowTask.update({
        where: { id: taskId },
        data: {
          status,
          assigneeUserId: actor.userId,
          decidedAt: new Date(),
          comment: input.comment ?? null,
          ...(task.claimedAt === null ? { claimedAt: new Date() } : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.task.decide',
        resource: 'workflow',
        resourceId: taskId,
        payload: { decision, stepKey: task.stepKey },
      });

      return this.advanceAfterDecision(tx, actor, instance, version, steps, step, decision);
    });
  }

  // ---------------------------------------------------------------------------
  // Step routing internals
  // ---------------------------------------------------------------------------

  /** Enters every entry step (no predecessors) of a freshly started instance. */
  private async enterInitialSteps(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    states: readonly WorkflowStateDefinition[],
    steps: readonly WorkflowStepDefinition[],
  ): Promise<void> {
    const entry = steps.filter((step) => step.predecessorKeys.length === 0);
    for (const step of entry) {
      await this.enterStep(tx, actor, instance, states, step);
    }
  }

  /**
   * Puts the instance at one step: mirrors the step's state, sets the SLA
   * timestamps, and materializes one task per candidate approver. Steps that do
   * not require approval satisfy immediately and advance past themselves.
   */
  private async enterStep(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    states: readonly WorkflowStateDefinition[],
    step: WorkflowStepDefinition,
  ): Promise<void> {
    void states;
    if (step.condition != null && !evaluateCondition(step.condition, instance)) {
      return;
    }

    const now = new Date();
    const dueAt =
      step.timeoutMinutes != null && step.timeoutMinutes > 0
        ? new Date(now.getTime() + step.timeoutMinutes * 60_000)
        : null;
    const escalationAt = dueAt;

    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: {
        ...(step.stateKey != null ? { currentStateKey: step.stateKey } : {}),
        stepKey: step.key,
        dueAt,
        escalationAt,
      },
    });

    if (!step.requiresApproval) {
      await this.satisfyStepAutomatically(tx, actor, instance, step);
      return;
    }

    const candidates = await this.resolveCandidates(tx, step.requiredPermission);
    if (candidates.length === 0) {
      const created = await tx.workflowTask.create({
        data: {
          companyId: actor.companyId,
          instanceId: instance.id,
          stepKey: step.key,
          stateKey: step.stateKey ?? null,
          status: 'PENDING',
          assigneeUserId: null,
          requiredPermission: step.requiredPermission ?? null,
          dueAt,
          escalationAt,
        },
      });
      await this.enqueueSlaJob(actor.companyId, instance.id, created.id, step.key, escalationAt);
      return;
    }

    for (const userId of candidates) {
      const created = await tx.workflowTask.create({
        data: {
          companyId: actor.companyId,
          instanceId: instance.id,
          stepKey: step.key,
          stateKey: step.stateKey ?? null,
          status: 'PENDING',
          assigneeUserId: userId,
          requiredPermission: step.requiredPermission ?? null,
          dueAt,
          escalationAt,
        },
      });
      await this.enqueueSlaJob(actor.companyId, instance.id, created.id, step.key, escalationAt);
      await this.notifications.emit(actor.companyId, actor.userId, {
        eventKey: 'workflow.task_assigned',
        userId,
        metadata: {
          detail: `Step "${step.name}" requires your approval.`,
        },
        correlationId: instance.id,
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'workflow.task.assign',
        resource: 'workflow',
        resourceId: instance.id,
        payload: { stepKey: step.key, assigneeUserId: userId },
      });
    }
  }

  /**
   * Arms the delayed SLA timer for one task.
   *
   * The job is the escalation trigger: when it comes due the worker inspects the
   * task and, if it is still open, hands it to a higher authority. A deterministic
   * `jobId` keeps re-entering a step from stacking duplicate timers, and the whole
   * enqueue is best-effort — an instance is still valid without a worker attached.
   */
  private async enqueueSlaJob(
    companyId: string,
    instanceId: string,
    taskId: string,
    stepKey: string,
    escalationAt: Date | null,
  ): Promise<void> {
    if (escalationAt === null || !this.queue.isConfigured) {
      return;
    }
    const payload: WorkflowSlaJob = {
      companyId,
      instanceId,
      taskId,
      stepKey,
      kind: 'ESCALATION',
    };
    await this.queue.getQueue(QUEUE_NAMES.WORKFLOW).add(WORKFLOW_SLA_JOB, payload, {
      delay: Math.max(0, escalationAt.getTime() - Date.now()),
      jobId: `workflow-sla-${taskId}`,
      removeOnComplete: true,
      removeOnFail: 500,
    });
  }

  /** Records a no-approval step as satisfied and moves on to its successors. */
  private async satisfyStepAutomatically(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    step: WorkflowStepDefinition,
  ): Promise<void> {
    await tx.workflowTask.create({
      data: {
        companyId: actor.companyId,
        instanceId: instance.id,
        stepKey: step.key,
        stateKey: step.stateKey ?? null,
        status: 'SKIPPED',
        assigneeUserId: null,
        requiredPermission: null,
        decidedAt: new Date(),
        comment: 'auto-satisfied',
      },
    });
    await this.advanceFrom(tx, actor, instance, step);
  }

  /**
   * After a decision on one task of a step, applies the step's decision rule and,
   * when the step is satisfied, advances the instance to its successors.
   */
  private async advanceAfterDecision(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    version: { states: unknown },
    steps: readonly WorkflowStepDefinition[],
    step: WorkflowStepDefinition,
    decision: string,
  ): Promise<WorkflowInstanceSummary> {
    void steps;
    const states = readStates(version.states);

    if (decision === 'REJECT') {
      return this.completeInstance(tx, actor, instance, 'REJECTED', step, states);
    }

    const siblingTasks = await tx.workflowTask.findMany({
      where: { instanceId: instance.id, stepKey: step.key },
    });
    // Escalation supersedes a task: the escalated/expired rows stay for the audit
    // trail but are no longer counted, so the step is judged only on the tasks an
    // approver can still act on.
    const actionable = siblingTasks.filter(
      (task) => task.status !== 'ESCALATED' && task.status !== 'EXPIRED',
    );
    const decided = actionable.filter(
      (task) => task.status === 'APPROVED' || task.status === 'SKIPPED',
    );
    const satisfied =
      step.decisionType === 'ANY_PREDECESSOR'
        ? decided.length > 0
        : actionable.length > 0 && decided.length === actionable.length;

    if (!satisfied) {
      const updated = await tx.workflowInstance.findFirstOrThrow({
        where: { id: instance.id },
        include: VERSION_INCLUDE,
      });
      return toInstanceSummary(updated);
    }

    // Cancel any still-open sibling tasks; the step is settled.
    await tx.workflowTask.updateMany({
      where: {
        instanceId: instance.id,
        stepKey: step.key,
        status: { in: ['PENDING', 'CLAIMED'] },
      },
      data: { status: 'SKIPPED', decidedAt: new Date(), comment: 'step settled' },
    });

    return this.advanceFrom(tx, actor, instance, step);
  }

  /** Enters the step's successors, or completes the instance at a terminal step. */
  private async advanceFrom(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    step: WorkflowStepDefinition,
  ): Promise<WorkflowInstanceSummary> {
    const version = await tx.workflowVersion.findFirst({ where: { id: instance.versionId } });
    if (version === null) {
      throw new NotFoundError('The workflow version does not exist.');
    }
    const steps = readSteps(version.steps);
    const states = readStates(version.states);
    const successors = step.nextKeys
      .map((key) => steps.find((candidate) => candidate.key === key))
      .filter((candidate): candidate is WorkflowStepDefinition => candidate != null);

    if (successors.length === 0) {
      return this.completeInstance(tx, actor, instance, 'COMPLETED', step, states);
    }

    for (const successor of successors) {
      await this.enterStep(tx, actor, instance, states, successor);
    }

    const updated = await tx.workflowInstance.findFirstOrThrow({
      where: { id: instance.id },
      include: VERSION_INCLUDE,
    });
    return toInstanceSummary(updated);
  }

  /** Settles the instance: terminal status, mirrored final state, cancelled tasks. */
  private async completeInstance(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    instance: RoutingInstance,
    status: 'COMPLETED' | 'APPROVED' | 'REJECTED',
    step: WorkflowStepDefinition,
    states: readonly WorkflowStateDefinition[],
  ): Promise<WorkflowInstanceSummary> {
    const finalState =
      step.stateKey ?? states.find((state) => state.isFinal)?.key ?? instance.currentStateKey;
    const updated = await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { status, currentStateKey: finalState, stepKey: step.key },
      include: VERSION_INCLUDE,
    });
    await tx.workflowTask.updateMany({
      where: { instanceId: instance.id, status: { in: ['PENDING', 'CLAIMED'] } },
      data: { status: 'SKIPPED', decidedAt: new Date(), comment: 'instance settled' },
    });
    await tx.workflowTransitionEvent.create({
      data: {
        companyId: actor.companyId,
        instanceId: instance.id,
        fromStateKey: instance.currentStateKey,
        toStateKey: finalState,
        transitionName: status,
        actorUserId: actor.userId,
      },
    });
    await this.logs.writeAudit(actor.companyId, {
      actorUserId: actor.userId,
      action: 'workflow.instance.complete',
      resource: 'workflow',
      resourceId: instance.id,
      payload: { status, stepKey: step.key },
    });
    return toInstanceSummary(updated);
  }

  /** Users active in the company whose roles grant the given `resource.action` key. */
  private async resolveCandidates(
    tx: Prisma.TransactionClient,
    permission: string | null,
  ): Promise<readonly string[]> {
    if (permission == null) {
      return [];
    }
    const parsed = parsePermissionKey(permission);
    if (parsed === null) {
      return [];
    }
    const rolePermissions = await tx.rolePermission.findMany({
      where: { permission: { resource: parsed.resource, action: parsed.action } },
      select: { roleId: true },
    });
    const roleIds = [...new Set(rolePermissions.map((row) => row.roleId))];
    if (roleIds.length === 0) {
      return [];
    }
    const memberships = await tx.userRole.findMany({
      where: { roleId: { in: roleIds } },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((row) => row.userId))];
    if (userIds.length === 0) {
      return [];
    }
    const users = await tx.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE' },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Checks the actor holds the step's required permission (when one is named). */
  private async assertStepPermission(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    stepKey: string,
    instanceId: string,
    step?: WorkflowStepDefinition,
  ): Promise<void> {
    void tx;
    void instanceId;
    const required = step?.requiredPermission;
    if (required == null) {
      return;
    }
    const parsed = parsePermissionKey(required);
    if (parsed === null) {
      throw new UnprocessableEntityError(`Step "${stepKey}" requires an unknown permission.`);
    }
    if (!can(actor.permissions, parsed.resource, parsed.action)) {
      throw new ForbiddenError(
        `You do not have the "${parsed.action}" permission on "${parsed.resource}" to act on this task.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async findDefinitionOrThrow(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<{ id: string; key: string }> {
    const definition = await tx.workflowDefinition.findFirst({
      where: { id },
      select: { id: true, key: true },
    });
    if (definition === null) {
      throw new NotFoundError('The workflow definition does not exist.');
    }
    return definition;
  }

  /**
   * Enforces the transition's permission requirement (defaulting to `workflow.approve`)
   * and, when it demands an approval, the approval-authority rules.
   */
  private async assertTransitionAllowed(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    resource: string | null,
    transition: WorkflowTransitionDefinition,
  ): Promise<void> {
    const required = transition.requiredPermission ?? DEFAULT_TRANSITION_PERMISSION;
    const parsed = parsePermissionKey(required);
    if (parsed === null) {
      throw new UnprocessableEntityError('The transition requires an unknown permission.');
    }
    if (!can(actor.permissions, parsed.resource, parsed.action)) {
      throw new ForbiddenError(
        `You do not have the "${parsed.action}" permission on "${parsed.resource}" to take this action.`,
      );
    }
    if (transition.requiresApproval && !(await this.isEffectiveApprover(tx, actor, resource))) {
      throw new ForbiddenError('You are not an authorized approver for this workflow.');
    }
  }

  /** Resolves whether the actor (or someone delegating to them) may approve this resource. */
  private async isEffectiveApprover(
    tx: Prisma.TransactionClient,
    actor: WorkflowActor,
    resource: string | null,
  ): Promise<boolean> {
    if (await this.hasAuthority(tx, actor.userId, resource)) {
      return true;
    }
    const delegations = await tx.approvalDelegation.findMany({
      where: { delegateeUserId: actor.userId },
    });
    const now = Date.now();
    for (const delegation of delegations) {
      if (!matchesResource(delegation.resource, resource) || !withinWindow(delegation, now)) {
        continue;
      }
      if (await this.hasAuthority(tx, delegation.delegatorUserId, resource)) {
        return true;
      }
    }
    return false;
  }

  /** Whether the given user holds an active authority rule covering this resource. */
  private async hasAuthority(
    tx: Prisma.TransactionClient,
    userId: string,
    resource: string | null,
  ): Promise<boolean> {
    const memberships = await tx.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const subjects = [
      { subjectType: 'USER' as const, subjectId: userId },
      ...memberships.map((membership) => ({
        subjectType: 'ROLE' as const,
        subjectId: membership.roleId,
      })),
    ];
    const now = Date.now();
    const authorities = await tx.approvalAuthority.findMany();
    return authorities.some(
      (authority) =>
        matchesResource(authority.resource, resource) &&
        withinWindow(authority, now) &&
        subjects.some(
          (subject) =>
            subject.subjectType === authority.subjectType &&
            subject.subjectId === authority.subjectId,
        ),
    );
  }
}

function readStates(value: unknown): WorkflowStateDefinition[] {
  return Array.isArray(value) ? (value as WorkflowStateDefinition[]) : [];
}

function readTransitions(value: unknown): WorkflowTransitionDefinition[] {
  return Array.isArray(value) ? (value as WorkflowTransitionDefinition[]) : [];
}

function readSteps(value: unknown): WorkflowStepDefinition[] {
  return Array.isArray(value) ? (value as WorkflowStepDefinition[]) : [];
}

function normalizeStates(input: readonly StateInput[]): WorkflowStateDefinition[] {
  const states = input.map((state, index) => {
    const key = (state.key ?? '').trim().toLowerCase();
    const name = (state.name ?? '').trim();
    if (!STATE_KEY_PATTERN.test(key)) {
      throw new ValidationError(
        `"${state.key ?? ''}" is not a valid state key (lower-case letters, digits and underscores).`,
      );
    }
    if (name.length === 0 || name.length > 120) {
      throw new ValidationError(`The state "${key}" needs a name of at most 120 characters.`);
    }
    return {
      key,
      name,
      isInitial: state.isInitial === true,
      isFinal: state.isFinal === true,
      sortOrder: state.sortOrder ?? index,
    };
  });
  const keys = new Set<string>();
  for (const state of states) {
    if (keys.has(state.key)) {
      throw new ValidationError(`The state key "${state.key}" is duplicated.`);
    }
    keys.add(state.key);
  }
  return states;
}

function normalizeTransitions(
  input: readonly TransitionInput[],
  states: readonly WorkflowStateDefinition[],
): WorkflowTransitionDefinition[] {
  const known = new Set(states.map((state) => state.key));
  const seen = new Set<string>();
  return input.map((transition, index) => {
    const name = (transition.name ?? '').trim();
    const fromStateKey = (transition.fromStateKey ?? '').trim();
    const toStateKey = (transition.toStateKey ?? '').trim();
    if (name.length === 0 || name.length > 80) {
      throw new ValidationError('A transition needs a name of at most 80 characters.');
    }
    if (!known.has(fromStateKey) || !known.has(toStateKey)) {
      throw new ValidationError(`The transition "${name}" refers to an unknown state.`);
    }
    if (fromStateKey === toStateKey) {
      throw new ValidationError(`The transition "${name}" cannot loop back to the same state.`);
    }
    const signature = `${fromStateKey}::${name}`;
    if (seen.has(signature)) {
      throw new ValidationError(
        `The transition "${name}" is duplicated for the state "${fromStateKey}".`,
      );
    }
    seen.add(signature);
    if (transition.requiredPermission != null) {
      const parsed = parsePermissionKey(transition.requiredPermission);
      if (parsed === null) {
        throw new ValidationError(
          `"${transition.requiredPermission}" is not a valid resource.action permission.`,
        );
      }
    }
    return {
      name,
      fromStateKey,
      toStateKey,
      requiredPermission: transition.requiredPermission ?? null,
      requiresApproval: transition.requiresApproval === true,
      sortOrder: transition.sortOrder ?? index,
    };
  });
}

/** A version needs at least one state and exactly one initial state. */
function assertStateMachine(
  states: readonly WorkflowStateDefinition[],
  transitions: readonly WorkflowTransitionDefinition[],
): void {
  if (states.length === 0) {
    throw new ValidationError('A workflow version needs at least one state.');
  }
  if (states.filter((state) => state.isInitial).length !== 1) {
    throw new ValidationError('A workflow version needs exactly one initial state.');
  }
  const keys = new Set(states.map((state) => state.key));
  for (const transition of transitions) {
    if (!keys.has(transition.fromStateKey) || !keys.has(transition.toStateKey)) {
      throw new ValidationError(`The transition "${transition.name}" refers to an unknown state.`);
    }
  }
}

/** When a version carries steps, the graph must be closed and have entry points. */
function assertStepGraph(steps: readonly WorkflowStepDefinition[]): void {
  if (steps.length === 0) {
    return;
  }
  const keys = new Set(steps.map((step) => step.key));
  for (const step of steps) {
    for (const predecessor of step.predecessorKeys) {
      if (!keys.has(predecessor)) {
        throw new ValidationError(`Step "${step.key}" has unknown predecessor "${predecessor}".`);
      }
    }
    for (const next of step.nextKeys) {
      if (!keys.has(next)) {
        throw new ValidationError(`Step "${step.key}" has unknown successor "${next}".`);
      }
    }
  }
  if (!steps.some((step) => step.predecessorKeys.length === 0)) {
    throw new ValidationError('The step graph needs at least one step without predecessors.');
  }
}

function matchesResource(ruleResource: string | null, resource: string | null): boolean {
  return ruleResource === null || resource === null || ruleResource === resource;
}

function withinWindow(
  rule: { effectiveFrom: Date | null; effectiveTo: Date | null },
  now: number,
): boolean {
  if (rule.effectiveFrom !== null && rule.effectiveFrom.getTime() > now) {
    return false;
  }
  if (rule.effectiveTo !== null && rule.effectiveTo.getTime() < now) {
    return false;
  }
  return true;
}

function toDefinitionSummary(definition: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: Date;
  versions: readonly { version: number; status: string }[];
}): WorkflowDefinitionSummary {
  const active = definition.versions.find((version) => version.status === 'ACTIVE');
  const draft = definition.versions.find((version) => version.status === 'DRAFT');
  return {
    id: definition.id,
    key: definition.key,
    name: definition.name,
    description: definition.description,
    createdAt: definition.createdAt.toISOString(),
    activeVersion: active?.version ?? null,
    draftVersion: draft?.version ?? null,
  };
}

function toVersionSummary(version: {
  id: string;
  version: number;
  status: string;
  states: unknown;
  transitions: unknown;
  steps?: unknown;
  publishedAt: Date | null;
  createdAt: Date;
}): WorkflowVersionSummary {
  return {
    id: version.id,
    version: version.version,
    status: version.status as WorkflowVersionSummary['status'],
    states: readStates(version.states),
    transitions: readTransitions(version.transitions),
    steps: readSteps(version.steps),
    publishedAt: version.publishedAt === null ? null : version.publishedAt.toISOString(),
    createdAt: version.createdAt.toISOString(),
  };
}

function toInstanceSummary(instance: InstanceRow): WorkflowInstanceSummary {
  return {
    id: instance.id,
    definitionId: instance.definitionId,
    version: instance.version.version,
    resource: instance.resource,
    resourceId: instance.resourceId,
    currentStateKey: instance.currentStateKey,
    status: instance.status as WorkflowInstanceStatus,
    stepKey: instance.stepKey,
    dueAt: instance.dueAt === null ? null : instance.dueAt.toISOString(),
    escalationAt: instance.escalationAt === null ? null : instance.escalationAt.toISOString(),
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

function toEventSummary(event: {
  id: string;
  fromStateKey: string | null;
  toStateKey: string;
  transitionName: string;
  actorUserId: string;
  comment: string | null;
  createdAt: Date;
}): WorkflowTransitionEventSummary {
  return {
    id: event.id,
    fromStateKey: event.fromStateKey,
    toStateKey: event.toStateKey,
    transitionName: event.transitionName,
    actorUserId: event.actorUserId,
    comment: event.comment,
    createdAt: event.createdAt.toISOString(),
  };
}

function toTaskSummary(task: {
  id: string;
  instanceId: string;
  stepKey: string;
  stateKey: string | null;
  status: WorkflowTaskStatus;
  assigneeUserId: string | null;
  requiredPermission: string | null;
  dueAt: Date | null;
  escalationAt: Date | null;
  escalatedAt: Date | null;
  claimedAt: Date | null;
  decidedAt: Date | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowTaskSummary {
  return {
    id: task.id,
    instanceId: task.instanceId,
    stepKey: task.stepKey,
    stateKey: task.stateKey,
    status: task.status,
    assigneeUserId: task.assigneeUserId,
    requiredPermission: task.requiredPermission,
    dueAt: task.dueAt === null ? null : task.dueAt.toISOString(),
    escalationAt: task.escalationAt === null ? null : task.escalationAt.toISOString(),
    escalatedAt: task.escalatedAt === null ? null : task.escalatedAt.toISOString(),
    claimedAt: task.claimedAt === null ? null : task.claimedAt.toISOString(),
    decidedAt: task.decidedAt === null ? null : task.decidedAt.toISOString(),
    decisionComment: task.comment,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * A minimal condition evaluator: `truthy` / `falsy` literals, and
 * `field==value` / `field!=value` comparisons against the instance payload.
 * Anything unrecognised evaluates to true (the step applies).
 */
function evaluateCondition(condition: string, instance: { resource: string | null }): boolean {
  const trimmed = condition.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed === 'truthy') {
    return true;
  }
  if (trimmed === 'falsy') {
    return false;
  }
  const comparison = /^([a-zA-Z0-9_.]+)\s*(==|!=)\s*(.+)$/.exec(trimmed);
  if (comparison === null) {
    return true;
  }
  const [, field, operator, rawValue] = comparison as unknown as [
    string,
    string,
    '==' | '!=',
    string,
  ];
  const expected = rawValue.trim().replace(/^['"]|['"]$/g, '');
  const actual = field === 'resource' ? (instance.resource ?? '') : '';
  return operator === '==' ? actual === expected : actual !== expected;
}

function normalizeSteps(
  input: readonly StepInput[],
  states: readonly WorkflowStateDefinition[] = [],
): WorkflowStepDefinition[] {
  const keys = new Set<string>();
  const stateKeys = new Set(states.map((state) => state.key));
  return input.map((s, idx) => {
    const key = (s.key ?? '').trim();
    if (key.length === 0) throw new ValidationError('Step key is required.');
    if (keys.has(key)) throw new ValidationError(`Duplicate step key "${key}".`);
    keys.add(key);
    const t = String(s.type ?? 'SEQUENTIAL').toUpperCase();
    const d = String(s.decisionType ?? 'ALL_PREDECESSORS').toUpperCase();
    if (!(WORKFLOW_STEP_TYPES as readonly string[]).includes(t))
      throw new ValidationError('Invalid step type.');
    if (!(WORKFLOW_STEP_DECISION_TYPES as readonly string[]).includes(d))
      throw new ValidationError('Invalid step decision type.');
    const predecessors = Array.isArray(s.predecessorKeys)
      ? s.predecessorKeys.map((x) => String(x))
      : [];
    const nextKeys = Array.isArray(s.nextKeys) ? s.nextKeys.map((x) => String(x)) : [];
    let timeout: number | null = null;
    if (s.timeoutMinutes !== undefined && s.timeoutMinutes !== null) {
      timeout = Number(s.timeoutMinutes);
      if (!Number.isFinite(timeout) || timeout < 0) timeout = null;
    }
    const stateKey = s.stateKey != null ? String(s.stateKey).trim() : null;
    if (stateKey != null && stateKeys.size > 0 && !stateKeys.has(stateKey)) {
      throw new ValidationError(`Step "${key}" refers to unknown state "${stateKey}".`);
    }
    if (s.requiredPermission != null) {
      const parsed = parsePermissionKey(s.requiredPermission);
      if (parsed === null) {
        throw new ValidationError(
          `"${s.requiredPermission}" is not a valid resource.action permission.`,
        );
      }
    }
    return {
      key,
      name: (s.name ?? key).trim(),
      type: t as WorkflowStepDefinition['type'],
      decisionType: d as WorkflowStepDefinition['decisionType'],
      requiredPermission: s.requiredPermission ?? null,
      requiresApproval: s.requiresApproval === true,
      sortOrder: s.sortOrder ?? idx,
      predecessorKeys: predecessors,
      nextKeys,
      condition: s.condition ?? null,
      timeoutMinutes: timeout,
      escalationPolicy: s.escalationPolicy ?? null,
      stateKey,
    };
  });
}
