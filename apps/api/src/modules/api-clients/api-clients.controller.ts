import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { ApiClientsService, type ApiClientActor } from './api-clients.service';

export class CreateApiClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopes!: string[];
}

export class UpdateApiClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Developer API clients (System -> API & Developer Platform).
 *
 * Reads require `api-client:view`; creation, rotation and deletion require the matching
 * `api-client` action. The secret is returned only by the create and rotate responses —
 * it is never readable again, so a client that loses it must be rotated.
 */
@Controller('developers/clients')
export class ApiClientsController {
  constructor(@Inject(ApiClientsService) private readonly clients: ApiClientsService) {}

  private actor(session: AuthenticatedRequest, principal: SessionPrincipal): ApiClientActor {
    return {
      companyId: session.companyId,
      userId: principal.user.id,
      permissions: principal.permissions,
    };
  }

  @Get()
  @RequirePermission('api-client', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<Awaited<ReturnType<ApiClientsService['list']>>> {
    return this.clients.list(session.companyId);
  }

  @Get(':id')
  @RequirePermission('api-client', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<Awaited<ReturnType<ApiClientsService['get']>>> {
    return this.clients.get(session.companyId, id);
  }

  @Post()
  @RequirePermission('api-client', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateApiClientDto,
  ): Promise<Awaited<ReturnType<ApiClientsService['create']>>> {
    return this.clients.create(this.actor(session, principal), dto);
  }

  @Patch(':id')
  @RequirePermission('api-client', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateApiClientDto,
  ): Promise<Awaited<ReturnType<ApiClientsService['update']>>> {
    return this.clients.update(this.actor(session, principal), id, dto);
  }

  @Post(':id/rotate')
  @RequirePermission('api-client', 'update')
  @HttpCode(HttpStatus.OK)
  async rotate(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<Awaited<ReturnType<ApiClientsService['rotate']>>> {
    return this.clients.rotate(this.actor(session, principal), id);
  }

  @Delete(':id')
  @RequirePermission('api-client', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.clients.remove(this.actor(session, principal), id);
  }
}
