import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

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
  Query,
} from '@nestjs/common';

import {
  type OrganizationalUnitSummary,
  type OrganizationEntitySummary,
  type Paginated,
  ORGANIZATIONAL_UNIT_TYPES,
  type OrganizationalUnitType,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { OrganizationService } from './organization.service';

export class CreateEntityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsString()
  @Length(3, 3)
  currencyCode!: string;
}

export class UpdateEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;
}

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsIn(ORGANIZATIONAL_UNIT_TYPES as readonly string[])
  type!: OrganizationalUnitType;

  @IsOptional()
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(ORGANIZATIONAL_UNIT_TYPES as readonly string[])
  type?: OrganizationalUnitType;

  @IsOptional()
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

/** Shared list filters, all optional. `limit`/`cursor` follow the pagination contract. */
export class OrganizationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsIn(ORGANIZATIONAL_UNIT_TYPES as readonly string[])
  type?: OrganizationalUnitType;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

/**
 * Organizational structure administration.
 *
 * Reads require `organization:view`; the other actions gate their mutations. The
 * caller's data scope narrows every read to the entities and units they may see, so a
 * delegated administrator cannot enumerate a sibling subtree.
 */
@Controller('organization')
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly organization: OrganizationService) {}

  // -- Legal entities ---------------------------------------------------------

  @Get('entities')
  @RequirePermission('organization', 'view')
  async listEntities(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: OrganizationQueryDto,
  ): Promise<Paginated<OrganizationEntitySummary>> {
    return this.organization.listEntities(
      session.companyId,
      principal,
      { search: query.search },
      normalisePageParams(query),
    );
  }

  @Get('entities/:id')
  @RequirePermission('organization', 'view')
  async getEntity(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<OrganizationEntitySummary> {
    return this.organization.getEntity(session.companyId, principal, id);
  }

  @Post('entities')
  @RequirePermission('organization', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createEntity(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateEntityDto,
  ): Promise<OrganizationEntitySummary> {
    return this.organization.createEntity(session.companyId, principal, dto);
  }

  @Patch('entities/:id')
  @RequirePermission('organization', 'update')
  async updateEntity(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateEntityDto,
  ): Promise<OrganizationEntitySummary> {
    return this.organization.updateEntity(session.companyId, principal, id, dto);
  }

  @Delete('entities/:id')
  @RequirePermission('organization', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntity(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.organization.deleteEntity(session.companyId, principal, id);
  }

  // -- Organizational units ---------------------------------------------------

  @Get('units')
  @RequirePermission('organization', 'view')
  async listUnits(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: OrganizationQueryDto,
  ): Promise<Paginated<OrganizationalUnitSummary>> {
    return this.organization.listUnits(
      session.companyId,
      principal,
      {
        entityId: query.entityId,
        parentId: query.parentId,
        type: query.type,
        search: query.search,
      },
      normalisePageParams(query),
    );
  }

  @Get('units/:id')
  @RequirePermission('organization', 'view')
  async getUnit(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<OrganizationalUnitSummary> {
    return this.organization.getUnit(session.companyId, principal, id);
  }

  @Post('units')
  @RequirePermission('organization', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createUnit(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateUnitDto,
  ): Promise<OrganizationalUnitSummary> {
    return this.organization.createUnit(session.companyId, principal, dto);
  }

  @Patch('units/:id')
  @RequirePermission('organization', 'update')
  async updateUnit(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<OrganizationalUnitSummary> {
    return this.organization.updateUnit(session.companyId, principal, id, dto);
  }

  @Delete('units/:id')
  @RequirePermission('organization', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUnit(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.organization.deleteUnit(session.companyId, principal, id);
  }
}
