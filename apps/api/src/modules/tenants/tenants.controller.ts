import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import type { TenantSummary } from '@hris/shared-types';
import { TenantsService } from './tenants.service';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seatLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  storageQuotaBytes?: number | null;

  @IsOptional()
  suspend?: boolean;

  @IsOptional()
  @IsBoolean()
  suspendFlag?: boolean;
}

@Controller('tenants')
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(): Promise<TenantSummary[]> {
    return this.tenants.list();
  }

  @Get(':id')
  @RequirePermission('registry', 'view')
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<TenantSummary> {
    return this.tenants.get(id);
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTenantDto,
  ): Promise<TenantSummary> {
    if (body.suspendFlag === true || body.suspend === true) {
      return this.tenants.update({ companyId: id, userId: principal.user.id }, id, {
        suspend: true,
      });
    }
    if (body.suspendFlag === false || body.suspend === false) {
      return this.tenants.update({ companyId: id, userId: principal.user.id }, id, {
        suspend: false,
      });
    }
    const input = {
      ...(body.status !== undefined ? { status: body.status as TenantSummary['status'] } : {}),
      ...(body.plan !== undefined ? { plan: body.plan as TenantSummary['plan'] } : {}),
      ...(body.seatLimit !== undefined ? { seatLimit: body.seatLimit } : {}),
      ...(body.storageQuotaBytes !== undefined
        ? { storageQuotaBytes: body.storageQuotaBytes }
        : {}),
    };
    return this.tenants.update({ companyId: id, userId: principal.user.id }, id, input);
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async suspend(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.tenants.update({ companyId: id, userId: principal.user.id }, id, { suspend: true });
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async activate(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.tenants.update({ companyId: id, userId: principal.user.id }, id, { suspend: false });
  }
}
