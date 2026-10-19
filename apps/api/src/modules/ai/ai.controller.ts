import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import {
  HttpCode,
  HttpStatus,
  Inject,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type {
  AiAskInput,
  AiCallSummary,
  AiProviderSummary,
  AiUsageSummary,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';

import { AiGateway } from './ai-gateway.service';
import { AiUsageService } from './ai-usage.service';

import { KnowledgeService } from './knowledge.service';

export class AddKnowledgeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;
}

export class AskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  /** Optional agent whose prompt, model and granted tools apply to this call. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  agentKey?: string;
}

@Controller('ai')
export class AiController {
  constructor(
    @Inject(AiGateway) private readonly gateway: AiGateway,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(AiUsageService) private readonly usage: AiUsageService,
  ) {}

  @Get('capabilities')
  @RequirePermission('ai', 'view')
  capabilities(): { enabled: boolean } {
    // Static capability flag; concrete enablement is per-company via isEnabled.
    return { enabled: true };
  }

  @Get('status')
  @RequirePermission('ai', 'view')
  async status(@CurrentAuth() session: AuthenticatedRequest): Promise<{ enabled: boolean }> {
    return { enabled: await this.knowledge.isEnabled(session.companyId) };
  }

  @Get('providers')
  @RequirePermission('ai', 'view')
  async providers(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<readonly AiProviderSummary[]> {
    return this.gateway.providers(session.companyId);
  }

  @Get('calls')
  @RequirePermission('ai', 'view')
  async calls(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<readonly AiCallSummary[]> {
    const parsed = limit === undefined ? undefined : Number.parseInt(limit, 10);
    return this.usage.listCalls(session.companyId, {
      limit: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      status: status === undefined || status === '' ? undefined : status,
    });
  }

  @Get('usage')
  @RequirePermission('ai', 'view')
  async usageSummary(@CurrentAuth() session: AuthenticatedRequest): Promise<AiUsageSummary> {
    return this.usage.usage(session.companyId);
  }

  @Get('knowledge')
  @RequirePermission('ai', 'view')
  async listKnowledge(@CurrentAuth() session: AuthenticatedRequest): Promise<unknown> {
    return this.knowledge.list(session.companyId);
  }

  @Post('knowledge')
  @RequirePermission('ai', 'create')
  async createKnowledge(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: AddKnowledgeDto,
  ): Promise<unknown> {
    return this.knowledge.create(session.companyId, principal.user.id, {
      title: body.title,
      kind: body.kind ?? 'POLICY',
      source: body.source ?? null,
      content: body.content,
    });
  }

  @Delete('knowledge/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ai', 'delete')
  async deleteKnowledge(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.knowledge.remove(session.companyId, id);
  }

  @Post('ask')
  @RequirePermission('ai', 'view')
  async ask(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: AskDto,
  ): Promise<unknown> {
    return this.gateway.ask(session.companyId, principal.user.id, body as AiAskInput);
  }
}
