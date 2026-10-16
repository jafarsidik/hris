import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
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
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { BusinessRuleSummary } from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { BusinessRulesService, type BusinessRuleInput } from './business-rules.service';

export class CreateBusinessRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  eventType!: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  actions?: readonly unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateBusinessRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  eventType?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  actions?: readonly unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

/** Narrow query filters. */
export class ListBusinessRulesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventType?: string;
}

@Controller('business-rules')
export class BusinessRulesController {
  constructor(@Inject(BusinessRulesService) private readonly rules: BusinessRulesService) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query() query: ListBusinessRulesQueryDto,
  ): Promise<BusinessRuleSummary[]> {
    return this.rules.list(session.companyId, query.eventType);
  }

  @Get(':id')
  @RequirePermission('workflow', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BusinessRuleSummary> {
    return this.rules.get(session.companyId, id);
  }

  @Post()
  @RequirePermission('workflow', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateBusinessRuleDto,
  ): Promise<BusinessRuleSummary> {
    const input: BusinessRuleInput = {
      name: body.name,
      description: body.description ?? null,
      eventType: body.eventType,
      condition: body.condition ?? {},
      actions: (body.actions ?? []) as readonly unknown[] as never,
      priority: body.priority ?? 100,
      isEnabled: body.isEnabled ?? true,
    };
    return this.rules.create({ companyId: session.companyId, userId: principal.user.id }, input);
  }

  @Patch(':id')
  @RequirePermission('workflow', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateBusinessRuleDto,
  ): Promise<BusinessRuleSummary> {
    return this.rules.update({ companyId: session.companyId, userId: principal.user.id }, id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.eventType !== undefined ? { eventType: body.eventType } : {}),
      ...(body.condition !== undefined ? { condition: body.condition } : {}),
      ...(body.actions !== undefined ? { actions: body.actions as never } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('workflow', 'manage')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.rules.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Post(':id/toggle')
  @RequirePermission('workflow', 'manage')
  async toggle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { isEnabled: boolean },
  ): Promise<BusinessRuleSummary> {
    return this.rules.toggle(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.isEnabled,
    );
  }
}
