import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Put,
  Query,
} from '@nestjs/common';

import { type SettingGroup, type SystemSettingReadModel } from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { CurrentPrincipal } from '../../common/auth/current.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { SettingsService, type SettingUpdateInput } from './settings.service';

export class UpdateSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SettingUpdateItemDto)
  items!: SettingUpdateItemDto[];
}

export class SettingUpdateItemDto implements SettingUpdateInput {
  @IsString()
  key!: string;

  @IsOptional()
  value!: unknown;
}

/**
 * System Settings surface (brief, Administration): tabbed by group, sensitive values
 * masked on read, updates audited. Reads require `setting.view`; writes require
 * `setting.update`.
 */
@Controller('settings')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('setting', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query('group') group?: string,
  ): Promise<SystemSettingReadModel[]> {
    return this.settings.listSettings(session.companyId, group);
  }

  @Get(':group')
  @RequirePermission('setting', 'view')
  async listGroup(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('group') group: SettingGroup,
  ): Promise<SystemSettingReadModel[]> {
    return this.settings.listSettings(session.companyId, group);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('setting', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SystemSettingReadModel[]> {
    return this.settings.updateSettings(session.companyId, principal.user.id, dto.items);
  }
}
