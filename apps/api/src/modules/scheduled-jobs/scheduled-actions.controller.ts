import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
} from '@nestjs/common';

import type { ScheduledActionSummary, ScheduledActionAction } from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { ScheduledActionsService, type ScheduledActionInput } from './scheduled-actions.service';

export class CreateScheduledActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(7)
  @MaxLength(200)
  cron!: string;

  @IsObject()
  action!: unknown;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateScheduledActionDto {
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
  @MinLength(7)
  @MaxLength(200)
  cron?: string;

  @IsOptional()
  @IsObject()
  action?: unknown;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Controller('scheduled-actions')
export class ScheduledActionsController {
  constructor(
    @Inject(ScheduledActionsService) private readonly schedules: ScheduledActionsService,
  ) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<ScheduledActionSummary[]> {
    return this.schedules.list(session.companyId);
  }

  @Get(':id')
  @RequirePermission('workflow', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ScheduledActionSummary> {
    return this.schedules.get(session.companyId, id);
  }

  @Post()
  @RequirePermission('workflow', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateScheduledActionDto,
  ): Promise<ScheduledActionSummary> {
    const input: ScheduledActionInput = {
      name: body.name,
      description: body.description ?? null,
      cron: body.cron,
      action: body.action as ScheduledActionAction,
      isEnabled: body.isEnabled ?? true,
    };
    return this.schedules.create(
      { companyId: session.companyId, userId: principal.user.id },
      input,
    );
  }

  @Patch(':id')
  @RequirePermission('workflow', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateScheduledActionDto,
  ): Promise<ScheduledActionSummary> {
    return this.schedules.update({ companyId: session.companyId, userId: principal.user.id }, id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.cron !== undefined ? { cron: body.cron } : {}),
      ...(body.action !== undefined ? { action: body.action as ScheduledActionAction } : {}),
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
    await this.schedules.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Post(':id/run')
  @RequirePermission('workflow', 'manage')
  async runNow(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.schedules.runNow({ companyId: session.companyId, userId: principal.user.id }, id);
  }
}
