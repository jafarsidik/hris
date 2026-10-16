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

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { FeatureFlagsService, type FeatureFlagInput } from './feature-flags.service';
import type { FeatureFlagSummary } from '@hris/shared-types';

export class CreateFeatureFlagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  rollout?: Record<string, unknown>;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  rollout?: Record<string, unknown>;
}

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(@Inject(FeatureFlagsService) private readonly flags: FeatureFlagsService) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<FeatureFlagSummary[]> {
    return this.flags.list(session.companyId);
  }

  @Get('resolve')
  @RequirePermission('registry', 'view')
  async resolve(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<{ key: string; enabled: boolean }[]> {
    return this.flags.resolve(session.companyId);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateFeatureFlagDto,
  ): Promise<FeatureFlagSummary> {
    const input = {
      key: body.key,
      name: body.name,
      description: body.description ?? null,
      enabled: body.enabled ?? false,
      rollout: body.rollout ?? {},
    } as FeatureFlagInput;
    return this.flags.create({ companyId: session.companyId, userId: principal.user.id }, input);
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagSummary> {
    return this.flags.update(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body as Partial<FeatureFlagInput>,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.flags.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Post(':id/toggle')
  @RequirePermission('registry', 'manage')
  async toggle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { enabled: boolean },
  ): Promise<FeatureFlagSummary> {
    return this.flags.toggle(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.enabled,
    );
  }
}
