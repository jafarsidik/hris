import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import type {
  AiAgentSummary,
  AiModelSummary,
  AiPromptSummary,
  AiToolSummary,
} from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { AiRegistryService } from './ai-registry.service';

const KEY_MAX = 120;
const CONTENT_MAX = 20_000;

export class CreateModelDto {
  @IsString()
  @MaxLength(KEY_MAX)
  key!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  contextWindow?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputPricePerMillion?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputPricePerMillion?: number | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  contextWindow?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputPricePerMillion?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputPricePerMillion?: number | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class CreatePromptDto {
  @IsString()
  @MaxLength(KEY_MAX)
  key!: string;

  @IsString()
  @MaxLength(CONTENT_MAX)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_MAX)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class CreateAgentDto {
  @IsString()
  @MaxLength(KEY_MAX)
  key!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(KEY_MAX)
  promptKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(KEY_MAX)
  modelKey?: string | null;

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(KEY_MAX, { each: true })
  tools?: readonly string[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(KEY_MAX)
  promptKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(KEY_MAX)
  modelKey?: string | null;

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(KEY_MAX, { each: true })
  tools?: readonly string[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class SetToolDto {
  @IsBoolean()
  enabled!: boolean;
}

@Controller('ai/models')
export class AiModelsController {
  constructor(@Inject(AiRegistryService) private readonly registry: AiRegistryService) {}

  @Get()
  @RequirePermission('ai', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<readonly AiModelSummary[]> {
    return this.registry.listModels(session.companyId);
  }

  @Post()
  @RequirePermission('ai', 'create')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() body: CreateModelDto,
  ): Promise<AiModelSummary> {
    return this.registry.createModel(session.companyId, body);
  }

  @Patch(':id')
  @RequirePermission('ai', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateModelDto,
  ): Promise<AiModelSummary> {
    return this.registry.updateModel(session.companyId, id, body);
  }

  @Delete(':id')
  @RequirePermission('ai', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.registry.removeModel(session.companyId, id);
  }
}

@Controller('ai/prompts')
export class AiPromptsController {
  constructor(@Inject(AiRegistryService) private readonly registry: AiRegistryService) {}

  @Get()
  @RequirePermission('ai', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<readonly AiPromptSummary[]> {
    return this.registry.listPrompts(session.companyId);
  }

  @Post()
  @RequirePermission('ai', 'create')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() body: CreatePromptDto,
  ): Promise<AiPromptSummary> {
    return this.registry.createPrompt(session.companyId, body);
  }

  @Patch(':id')
  @RequirePermission('ai', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdatePromptDto,
  ): Promise<AiPromptSummary> {
    return this.registry.updatePrompt(session.companyId, id, body);
  }

  @Delete(':id')
  @RequirePermission('ai', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.registry.removePrompt(session.companyId, id);
  }
}

@Controller('ai/agents')
export class AiAgentsController {
  constructor(@Inject(AiRegistryService) private readonly registry: AiRegistryService) {}

  @Get()
  @RequirePermission('ai', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<readonly AiAgentSummary[]> {
    return this.registry.listAgents(session.companyId);
  }

  @Post()
  @RequirePermission('ai', 'create')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() body: CreateAgentDto,
  ): Promise<AiAgentSummary> {
    return this.registry.createAgent(session.companyId, body);
  }

  @Patch(':id')
  @RequirePermission('ai', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateAgentDto,
  ): Promise<AiAgentSummary> {
    return this.registry.updateAgent(session.companyId, id, body);
  }

  @Delete(':id')
  @RequirePermission('ai', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.registry.removeAgent(session.companyId, id);
  }
}

@Controller('ai/tools')
export class AiToolsController {
  constructor(@Inject(AiRegistryService) private readonly registry: AiRegistryService) {}

  @Get()
  @RequirePermission('ai', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<readonly AiToolSummary[]> {
    return this.registry.listTools(session.companyId);
  }

  /**
   * PUT rather than PATCH: this sets availability for a known key idempotently —
   * there is no partial document, only an on/off override of the built-in default.
   */
  @Put(':key')
  @RequirePermission('ai', 'manage')
  async set(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() body: SetToolDto,
  ): Promise<AiToolSummary> {
    return this.registry.setTool(session.companyId, key, body.enabled);
  }

  @Delete(':key')
  @RequirePermission('ai', 'manage')
  async reset(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('key') key: string,
  ): Promise<AiToolSummary> {
    return this.registry.resetTool(session.companyId, key);
  }
}
