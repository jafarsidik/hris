import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
import { DataPoliciesService } from './data-policies.service';
import type { DataPolicySummary } from '@hris/shared-types';

export class CreateDataPolicyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  classification?: string;

  @IsString()
  @MaxLength(64)
  targetResource!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maskingAction?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class PatchDataPolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  classification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetResource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maskingAction?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Controller('data-policies')
export class DataPoliciesController {
  constructor(@Inject(DataPoliciesService) private readonly policies: DataPoliciesService) {}

  @Get()
  @RequirePermission('registry', 'view')
  list(@CurrentAuth() session: AuthenticatedRequest): Promise<DataPolicySummary[]> {
    return this.policies.list(session.companyId);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateDataPolicyDto,
  ): Promise<DataPolicySummary> {
    return this.policies.create(
      { companyId: session.companyId, userId: principal.user.id },
      {
        name: body.name,
        description: body.description ?? null,
        classification: body.classification ?? 'internal',
        targetResource: body.targetResource,
        maskingAction: body.maskingAction ?? 'mask',
        isEnabled: body.isEnabled ?? true,
      },
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchDataPolicyDto,
  ): Promise<DataPolicySummary> {
    const patch: Parameters<typeof this.policies.update>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.classification !== undefined) patch.classification = body.classification;
    if (body.targetResource !== undefined) patch.targetResource = body.targetResource;
    if (body.maskingAction !== undefined) patch.maskingAction = body.maskingAction;
    if (body.isEnabled !== undefined) patch.isEnabled = body.isEnabled;
    return this.policies.update(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      patch,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.policies.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }
}
