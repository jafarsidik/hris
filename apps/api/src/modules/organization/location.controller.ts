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
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { type Paginated, normalisePageParams, type WorkLocationSummary } from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { LocationService } from './location.service';

export class LocationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class LocationBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string | null;

  @IsOptional()
  @IsBoolean()
  isHeadquarters?: boolean;
}

/**
 * Work locations: offices and sites. Every route requires `organization:view`;
 * mutations additionally require company-wide scope, matching the entity and
 * unit gateways.
 */
@Controller('organization')
export class LocationController {
  constructor(@Inject(LocationService) private readonly locations: LocationService) {}

  @Get('locations')
  @RequirePermission('organization', 'view')
  list(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: LocationQueryDto,
  ): Promise<Paginated<WorkLocationSummary>> {
    return this.locations.list(
      session.companyId,
      principal,
      { city: query.city, search: query.search },
      normalisePageParams(query),
    );
  }

  @Post('locations')
  @RequirePermission('organization', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: LocationBodyDto,
  ): Promise<WorkLocationSummary> {
    return this.locations.create(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      city: dto.city ?? null,
      country: dto.country ?? null,
      address: dto.address ?? null,
      timezone: dto.timezone ?? null,
      isHeadquarters: dto.isHeadquarters ?? false,
    });
  }

  @Patch('locations/:id')
  @RequirePermission('organization', 'update')
  update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: LocationBodyDto,
  ): Promise<WorkLocationSummary> {
    return this.locations.update(session.companyId, principal, id, {
      code: dto.code,
      name: dto.name,
      city: dto.city,
      country: dto.country,
      address: dto.address,
      timezone: dto.timezone,
      isHeadquarters: dto.isHeadquarters,
    });
  }

  @Delete('locations/:id')
  @RequirePermission('organization', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.locations.remove(session.companyId, principal, id);
  }
}
