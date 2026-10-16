import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
import { type UserGroupMemberSummary, type UserGroupSummary } from '@hris/shared-types';
import { UserGroupsService } from './user-groups.service';

export class CreateUserGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class PatchUserGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class AddMemberDto {
  @IsString()
  userId!: string;
}

@Controller('user-groups')
export class UserGroupsController {
  constructor(@Inject(UserGroupsService) private readonly groups: UserGroupsService) {}

  @Get()
  @RequirePermission('registry', 'view')
  list(@CurrentAuth() session: AuthenticatedRequest): Promise<UserGroupSummary[]> {
    return this.groups.list(session.companyId);
  }

  @Get(':id')
  @RequirePermission('registry', 'view')
  get(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserGroupSummary> {
    return this.groups.get(session.companyId, id);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateUserGroupDto,
  ): Promise<UserGroupSummary> {
    return this.groups.create(
      { companyId: session.companyId, userId: principal.user.id },
      { name: body.name, description: body.description ?? null },
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchUserGroupDto,
  ): Promise<UserGroupSummary> {
    return this.groups.update(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.groups.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Get(':id/members')
  @RequirePermission('registry', 'view')
  async members(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserGroupMemberSummary[]> {
    return this.groups.listMembers(session.companyId, id);
  }

  @Post(':id/members')
  @RequirePermission('registry', 'manage')
  async addMember(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AddMemberDto,
  ): Promise<void> {
    await this.groups.addMember(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body.userId,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async removeMember(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.groups.removeMember(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      userId,
    );
  }
}
