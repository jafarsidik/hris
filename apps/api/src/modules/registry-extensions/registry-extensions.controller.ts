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
import { RegistryExtensionsService } from './registry-extensions.service';
import type {
  ConfigurationSchemaInput,
  ConfigurationSchemaSummary,
  ExtensionInput,
  ExtensionSummary,
} from '@hris/shared-types';

export class CreateConfigurationSchemaDto implements ConfigurationSchemaInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  resourceKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PatchConfigurationSchemaDto implements Partial<ConfigurationSchemaInput> {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  resourceKey?: string;

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
  @IsObject()
  schemaJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExtensionDto implements ExtensionInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  extensionKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  manifest?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class PatchExtensionDto implements Partial<ExtensionInput> {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  extensionKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  manifest?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Controller('registry/configuration-schemas')
export class ConfigurationSchemasController {
  constructor(
    @Inject(RegistryExtensionsService) private readonly schemas: RegistryExtensionsService,
  ) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<ConfigurationSchemaSummary[]> {
    return this.schemas.listSchemas(session.companyId);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateConfigurationSchemaDto,
  ): Promise<ConfigurationSchemaSummary> {
    return this.schemas.createSchema(
      { companyId: session.companyId, userId: principal.user.id },
      body,
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchConfigurationSchemaDto,
  ): Promise<ConfigurationSchemaSummary> {
    return this.schemas.updateSchema(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body,
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
    await this.schemas.removeSchema(
      { companyId: session.companyId, userId: principal.user.id },
      id,
    );
  }

  @Post(':id/toggle')
  @RequirePermission('registry', 'manage')
  async toggle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { isActive: boolean },
  ): Promise<ConfigurationSchemaSummary> {
    return this.schemas.toggleSchema(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.isActive,
    );
  }
}

@Controller('registry/extensions')
export class ExtensionsController {
  constructor(
    @Inject(RegistryExtensionsService) private readonly extensions: RegistryExtensionsService,
  ) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<ExtensionSummary[]> {
    return this.extensions.listExtensions(session.companyId);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateExtensionDto,
  ): Promise<ExtensionSummary> {
    return this.extensions.createExtension(
      { companyId: session.companyId, userId: principal.user.id },
      body,
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchExtensionDto,
  ): Promise<ExtensionSummary> {
    return this.extensions.updateExtension(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body,
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
    await this.extensions.removeExtension(
      { companyId: session.companyId, userId: principal.user.id },
      id,
    );
  }

  @Post(':id/toggle')
  @RequirePermission('registry', 'manage')
  async toggle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { isEnabled: boolean },
  ): Promise<ExtensionSummary> {
    return this.extensions.toggleExtension(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.isEnabled,
    );
  }
}
