import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import {
  WORKFLOW_INSTANCE_STATUSES,
  WORKFLOW_STEP_DECISION_TYPES,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_TASK_DECISIONS,
  WORKFLOW_TASK_STATUSES,
  type WorkflowInstanceStatus,
  type WorkflowTaskStatus,
} from '@hris/shared-types';

import { WorkflowService, type WorkflowActor } from './workflow.service';

export class CreateWorkflowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class WorkflowStateDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isInitial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class WorkflowTransitionDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(64)
  fromStateKey!: string;

  @IsString()
  @MaxLength(64)
  toStateKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  requiredPermission?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class WorkflowStepDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(WORKFLOW_STEP_TYPES as readonly string[])
  type?: string;

  @IsOptional()
  @IsIn(WORKFLOW_STEP_DECISION_TYPES as readonly string[])
  decisionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  requiredPermission?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  predecessorKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nextKeys?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  condition?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeoutMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  escalationPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  stateKey?: string;
}

export class UpdateWorkflowVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStateDto)
  states!: WorkflowStateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions!: WorkflowTransitionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];
}

export class StartWorkflowInstanceDto {
  @IsUUID()
  definitionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  resourceId?: string;
}

export class ExecuteTransitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  transition!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ListInstancesQueryDto {
  @IsOptional()
  @IsUUID()
  definitionId?: string;

  @IsOptional()
  @IsIn(WORKFLOW_INSTANCE_STATUSES as readonly string[])
  status?: WorkflowInstanceStatus;
}

function actor(session: AuthenticatedRequest, principal: SessionPrincipal): WorkflowActor {
  return {
    companyId: session.companyId,
    userId: principal.user.id,
    permissions: principal.permissions,
  };
}

/**
 * Workflow definition and version authoring.
 *
 * Reads require `workflow:view`; creating, editing and publishing require the matching
 * `workflow` action. Publishing is what makes a version runnable — draft versions can be
 * edited freely, published versions are immutable and are what new instances pin.
 */
@Controller('workflows')
export class WorkflowDefinitionsController {
  constructor(@Inject(WorkflowService) private readonly workflows: WorkflowService) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest) {
    return this.workflows.listDefinitions(session.companyId);
  }

  @Get(':id')
  @RequirePermission('workflow', 'view')
  async get(@CurrentAuth() session: AuthenticatedRequest, @Param('id') id: string) {
    return this.workflows.getDefinition(session.companyId, id);
  }

  @Post()
  @RequirePermission('workflow', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflows.createDefinition(actor(session, principal), dto);
  }

  @Patch(':id')
  @RequirePermission('workflow', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.updateDefinition(actor(session, principal), id, dto);
  }

  @Delete(':id')
  @RequirePermission('workflow', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.workflows.deleteDefinition(actor(session, principal), id);
  }

  @Post(':id/versions')
  @RequirePermission('workflow', 'update')
  @HttpCode(HttpStatus.CREATED)
  async createVersion(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.workflows.createVersion(actor(session, principal), id);
  }

  @Put(':id/versions/:version')
  @RequirePermission('workflow', 'update')
  async updateVersion(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: UpdateWorkflowVersionDto,
  ) {
    return this.workflows.updateVersion(actor(session, principal), id, version, dto);
  }

  @Post(':id/versions/:version/publish')
  @RequirePermission('workflow', 'update')
  @HttpCode(HttpStatus.OK)
  async publishVersion(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.workflows.publishVersion(actor(session, principal), id, version);
  }
}

/**
 * Workflow runtime.
 *
 * Starting an instance requires `workflow:create` and cancelling requires
 * `workflow:manage`. Executing a transition is authorised per transition by the engine
 * (its declared permission, defaulting to `workflow:approve`), so it carries no static
 * requirement — every transition still re-checks live permissions on this request.
 */
@Controller('workflow-instances')
export class WorkflowInstancesController {
  constructor(@Inject(WorkflowService) private readonly workflows: WorkflowService) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest, @Query() query: ListInstancesQueryDto) {
    return this.workflows.listInstances(session.companyId, query);
  }

  @Get(':id')
  @RequirePermission('workflow', 'view')
  async get(@CurrentAuth() session: AuthenticatedRequest, @Param('id') id: string) {
    return this.workflows.getInstance(session.companyId, id);
  }

  @Post()
  @RequirePermission('workflow', 'create')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: StartWorkflowInstanceDto,
  ) {
    return this.workflows.startInstance(actor(session, principal), dto);
  }

  @Post(':id/transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: ExecuteTransitionDto,
  ) {
    return this.workflows.executeTransition(actor(session, principal), id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('workflow', 'manage')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.workflows.cancelInstance(actor(session, principal), id);
  }
}

export class DecideWorkflowTaskDto {
  @IsIn(WORKFLOW_TASK_DECISIONS as readonly string[])
  decision!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ListTasksQueryDto {
  @IsOptional()
  @IsUUID()
  instanceId?: string;

  @IsOptional()
  @IsIn(WORKFLOW_TASK_STATUSES as readonly string[])
  status?: WorkflowTaskStatus;

  @IsOptional()
  @IsIn(['me'])
  assignee?: string;
}

/**
 * The only filter the caller's own inbox accepts.
 *
 * The inbox is scoped to the signed-in user by the route, so pages and instance ids are
 * not parameters: a narrower status is added on top of "assigned to me".
 */
export class ListMyTasksQueryDto {
  @IsOptional()
  @IsIn(WORKFLOW_TASK_STATUSES as readonly string[])
  status?: WorkflowTaskStatus;
}

/**
 * Workflow task inbox.
 *
 * Listing requires `workflow:view`; claiming and deciding are authorised per step by
 * the engine (the step's required permission and, when it demands approval, the
 * approval-authority rules), so those routes carry no static permission beyond the
 * session itself.
 */
@Controller('workflow-tasks')
export class WorkflowTasksController {
  constructor(@Inject(WorkflowService) private readonly workflows: WorkflowService) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest, @Query() query: ListTasksQueryDto) {
    return this.workflows.listTasks(session.companyId, {
      ...(query.instanceId === undefined ? {} : { instanceId: query.instanceId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.assignee === undefined ? {} : { assigneeUserId: session.userId }),
    });
  }

  /**
   * The caller's own inbox.
   *
   * Deliberately separate from {@link list} and gated on `workflow:approve` rather than
   * `workflow:view`: an approver is asked to act on a task, not to administer the whole
   * endpoint. Reading the instance of a task they can act on stays the engine's job.
   *
   * `mine` must be declared before the `:id` route, or Nest would resolve it as an id.
   */
  @Get('mine')
  @RequirePermission('workflow', 'approve')
  async mine(@CurrentAuth() session: AuthenticatedRequest, @Query() query: ListMyTasksQueryDto) {
    return this.workflows.listTasks(session.companyId, {
      assigneeUserId: session.userId,
      ...(query.status === undefined ? {} : { status: query.status }),
    });
  }
  @Get(':id')
  @RequirePermission('workflow', 'view')
  async get(@CurrentAuth() session: AuthenticatedRequest, @Param('id') id: string) {
    return this.workflows.getTask(session.companyId, id);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  async claim(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.workflows.claimTask(actor(session, principal), id);
  }

  @Post(':id/decisions')
  @HttpCode(HttpStatus.OK)
  async decide(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: DecideWorkflowTaskDto,
  ) {
    return this.workflows.decideTask(actor(session, principal), id, dto);
  }
}
