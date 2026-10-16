import {
  IsBoolean,
  IsInt,
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
} from '@nestjs/common';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { DataRetentionService } from './data-retention.service';
import type { DataRetentionScheduleInput, DataRetentionScheduleSummary } from '@hris/shared-types';

export class CreateDataRetentionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  resource!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  purgeAfterDays?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class PatchDataRetentionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  resource?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  purgeAfterDays?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Controller('data-retention')
export class DataRetentionController {
  constructor(@Inject(DataRetentionService) private readonly schedules: DataRetentionService) {}

  @Get()
  @RequirePermission('document', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<DataRetentionScheduleSummary[]> {
    return this.schedules.list(session.companyId);
  }

  @Post()
  @RequirePermission('document', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateDataRetentionDto,
  ): Promise<DataRetentionScheduleSummary> {
    const input: DataRetentionScheduleInput = {
      resource: body.resource,
      retentionDays: body.retentionDays ?? 30,
      purgeAfterDays: body.purgeAfterDays,
      isEnabled: body.isEnabled ?? true,
    };
    return this.schedules.create(
      { companyId: session.companyId, userId: principal.user.id },
      input,
    );
  }

  @Patch(':id')
  @RequirePermission('document', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchDataRetentionDto,
  ): Promise<DataRetentionScheduleSummary> {
    return this.schedules.update(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('document', 'manage')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.schedules.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Post(':id/toggle')
  @RequirePermission('document', 'manage')
  async toggle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { isEnabled: boolean },
  ): Promise<DataRetentionScheduleSummary> {
    return this.schedules.toggle(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.isEnabled,
    );
  }
}
