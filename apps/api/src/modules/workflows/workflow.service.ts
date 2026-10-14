import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  parsePermissionKey,
  type WorkflowDefinitionSummary,
  type WorkflowInstanceStatus,
  type WorkflowInstanceSummary,
  type WorkflowStateDefinition,
  type WorkflowTransitionDefinition,
  type WorkflowTransitionEventSummary,
  type WorkflowVersionSummary,
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
    input: { states?: StateInput[]; transitions?: TransitionInput[] },
  ): Promise<WorkflowVersionSummary> {
    const states = normalizeStates(input.states ?? []);
    const transitions = normalizeTransitions(input.transitions ?? [], states);
    assertStateMachine(states, transitions);

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
      const events = await tx.workflowTransitionEvent.findMany({
        where: { instanceId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return { instance: toInstanceSummary(instance), history: events.map(toEventSummary) };
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
      const initial = readStates(active.states).find((state) => state.isInitial);
      if (initial === undefined) {
        throw new ConflictError('The active workflow version has no initial state.');
      }

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
  publishedAt: Date | null;
  createdAt: Date;
}): WorkflowVersionSummary {
  return {
    id: version.id,
    version: version.version,
    status: version.status as WorkflowVersionSummary['status'],
    states: readStates(version.states),
    transitions: readTransitions(version.transitions),
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
