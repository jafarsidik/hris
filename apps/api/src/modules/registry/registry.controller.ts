import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import {
  FIELD_DATA_TYPES,
  RESOURCE_TYPES,
  type ApplicationSummary,
  type CreateApplicationInput,
  type CreateModuleInput,
  type CreateRegisteredActionInput,
  type CreateResourceFieldInput,
  type CreateResourceInput,
  type ModuleSummary,
  type ResourceSummary,
  type UpdateApplicationInput,
  type UpdateModuleInput,
  type UpdateResourceInput,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RegistryService, type RegistryActor } from './registry.service';

// ------------------------------------------------------------------ DTOs

export class CreateApplicationDto implements CreateApplicationInput {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateApplicationDto implements UpdateApplicationInput {
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
  @IsBoolean()
  isActive?: boolean;
}

export class CreateModuleDto implements CreateModuleInput {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  applicationKey!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateModuleDto implements UpdateModuleInput {
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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateResourceDto implements CreateResourceInput {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  applicationKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  moduleKey?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(RESOURCE_TYPES)
  resourceType!: CreateResourceInput['resourceType'];

  @IsOptional()
  @IsBoolean()
  supportsCrud?: boolean;
}

export class UpdateResourceDto implements UpdateResourceInput {
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
  @IsIn(RESOURCE_TYPES)
  resourceType?: UpdateResourceInput['resourceType'];

  @IsOptional()
  @IsBoolean()
  supportsCrud?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateResourceFieldDto implements CreateResourceFieldInput {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsIn(FIELD_DATA_TYPES)
  dataType!: CreateResourceFieldInput['dataType'];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateRegisteredActionDto implements CreateRegisteredActionInput {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  action!: string;

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
  isCustom?: boolean;
}

/**
 * Platform metadata registry (System -> Application & Metadata).
 *
 * Reads are open to any holder of `registry:view`; writes require `registry:create`
 * (registering new metadata) or `registry:update` (changing it). Registration is how
 * an application extends the platform without editing core source.
 */
@Controller('platform/registry')
export class RegistryController {
  constructor(@Inject(RegistryService) private readonly registry: RegistryService) {}

  private actor(session: AuthenticatedRequest, principal: SessionPrincipal): RegistryActor {
    return { companyId: session.companyId, userId: principal.user.id };
  }

  // ------------------------------------------------------------------ reads

  @Get('applications')
  @RequirePermission('registry', 'view')
  async listApplications(): Promise<ApplicationSummary[]> {
    return this.registry.listApplications();
  }

  @Get('modules')
  @RequirePermission('registry', 'view')
  async listModules(): Promise<ModuleSummary[]> {
    return this.registry.listModules();
  }

  @Get('resources')
  @RequirePermission('registry', 'view')
  async listResources(): Promise<ResourceSummary[]> {
    return this.registry.listResources();
  }

  @Get('resources/:resourceKey')
  @RequirePermission('registry', 'view')
  async getResource(@Param('resourceKey') resourceKey: string): Promise<ResourceSummary> {
    return this.registry.getResource(resourceKey);
  }

  // ---------------------------------------------------------------- writes

  @Post('applications')
  @RequirePermission('registry', 'create')
  @HttpCode(HttpStatus.OK)
  async createApplication(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationSummary> {
    return this.registry.createApplication(dto, this.actor(session, principal));
  }

  @Patch('applications/:key')
  @RequirePermission('registry', 'update')
  async updateApplication(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('key') key: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationSummary> {
    return this.registry.updateApplication(key, dto, this.actor(session, principal));
  }

  @Post('modules')
  @RequirePermission('registry', 'create')
  @HttpCode(HttpStatus.OK)
  async createModule(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateModuleDto,
  ): Promise<ModuleSummary> {
    return this.registry.createModule(dto, this.actor(session, principal));
  }

  @Patch('modules/:key')
  @RequirePermission('registry', 'update')
  async updateModule(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('key') key: string,
    @Body() dto: UpdateModuleDto,
  ): Promise<ModuleSummary> {
    return this.registry.updateModule(key, dto, this.actor(session, principal));
  }

  @Post('resources')
  @RequirePermission('registry', 'create')
  @HttpCode(HttpStatus.OK)
  async createResource(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceSummary> {
    return this.registry.createResource(dto, this.actor(session, principal));
  }

  @Patch('resources/:key')
  @RequirePermission('registry', 'update')
  async updateResource(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('key') key: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceSummary> {
    return this.registry.updateResource(key, dto, this.actor(session, principal));
  }

  @Post('resources/:key/fields')
  @RequirePermission('registry', 'create')
  @HttpCode(HttpStatus.OK)
  async addResourceField(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('key') key: string,
    @Body() dto: CreateResourceFieldDto,
  ): Promise<ResourceSummary> {
    return this.registry.addResourceField(key, dto, this.actor(session, principal));
  }

  @Post('resources/:key/actions')
  @RequirePermission('registry', 'create')
  @HttpCode(HttpStatus.OK)
  async addResourceAction(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('key') key: string,
    @Body() dto: CreateRegisteredActionDto,
  ): Promise<ResourceSummary> {
    return this.registry.addResourceAction(key, dto, this.actor(session, principal));
  }
}
