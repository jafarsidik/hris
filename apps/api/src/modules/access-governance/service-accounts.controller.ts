import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
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
import { ServiceAccountsService } from './access-reviews.service';
import type { ServiceAccountSummary } from '@hris/shared-types';

export class CreateServiceAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  key!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class PatchServiceAccountDto {
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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@Controller('service-accounts')
export class ServiceAccountsController {
  constructor(@Inject(ServiceAccountsService) private readonly accounts: ServiceAccountsService) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<ServiceAccountSummary[]> {
    return this.accounts.list(session.companyId);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateServiceAccountDto,
  ): Promise<{ summary: ServiceAccountSummary; secret: string }> {
    return this.accounts.create(
      { companyId: session.companyId, userId: principal.user.id },
      {
        name: body.name,
        description: body.description ?? null,
        key: body.key,
        expiresAt: body.expiresAt ?? null,
      },
    );
  }

  @Post(':id/rotate-secret')
  @RequirePermission('registry', 'manage')
  async rotateSecret(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ secret: string }> {
    return this.accounts.rotateSecret(
      { companyId: session.companyId, userId: principal.user.id },
      id,
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchServiceAccountDto,
  ): Promise<ServiceAccountSummary> {
    return this.accounts.update({ companyId: session.companyId, userId: principal.user.id }, id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ?? null } : {}),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.accounts.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }
}
