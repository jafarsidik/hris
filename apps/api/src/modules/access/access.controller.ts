import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  Put,
  Query,
} from '@nestjs/common';

import {
  type DataScope,
  type SessionInfo,
  type Paginated,
  ACTIONS,
  DATA_SCOPES,
  RESOURCES,
  normalisePageParams,
  type PermissionGrant,
} from '@hris/shared-types';

import { IsHrisPassword } from '../auth/auth.dto';
import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import {
  AccessService,
  type UserSummary,
  type RoleSummary,
  type RoleDetail,
  type PermissionRow,
  type ManageableUserStatus,
} from './access.service';

const USER_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
const MANAGEABLE_STATUSES: readonly ManageableUserStatus[] = ['ACTIVE', 'SUSPENDED', 'DISABLED'];

// ------------------------------------------------------------------ DTOs

export class UsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @IsHrisPassword()
  password!: string;

  @IsArray()
  roleIds!: string[];

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsArray()
  roleIds?: string[];

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string | null;
}

export class ChangeUserStatusDto {
  @IsIn(MANAGEABLE_STATUSES)
  status!: ManageableUserStatus;
}

export class CreateRoleDto {
  @IsString()
  @MinLength(2, { message: 'The role key is too short.' })
  @MaxLength(40)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  permissions?: GrantDto[];
}

export class UpdateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(500)
  description!: string;
}

export class ReplaceRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  permissions!: GrantDto[];
}

export class GrantDto implements PermissionGrant {
  @IsIn(RESOURCES)
  resource!: PermissionGrant['resource'];

  @IsIn(ACTIONS)
  action!: PermissionGrant['action'];

  @IsIn(DATA_SCOPES)
  scope!: DataScope;

  @IsOptional()
  @IsString()
  scopeId?: string;
}

/**
 * Administration of users, roles and permissions (brief, M07 Administration).
 *
 * Every action is gated on the caller's effective permissions resolved by the
 * AuthorizationGuard; `user.create` may invite without being able to `role.update`,
 * and so on.
 */
@Controller()
export class AccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  // ------------------------------------------------------------------ users

  @Get('users')
  @RequirePermission('user', 'view')
  async listUsers(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: UsersQueryDto,
  ): Promise<Paginated<UserSummary>> {
    return this.access.listUsers(
      session.companyId,
      principal,
      {
        search: query.search,
        status: query.status,
        roleKey: query.roleKey,
        organizationalUnitId: query.organizationalUnitId,
      },
      normalisePageParams(query),
    );
  }

  @Post('users')
  @RequirePermission('user', 'create')
  @HttpCode(HttpStatus.OK)
  async createUser(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateUserDto,
  ): Promise<UserSummary> {
    return this.access.createUser(session.companyId, principal, dto);
  }

  @Get('users/:userId')
  @RequirePermission('user', 'view')
  async getUser(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('userId') userId: string,
  ): Promise<UserSummary> {
    return this.access.getUser(session.companyId, principal, userId);
  }

  @Patch('users/:userId')
  @RequirePermission('user', 'update')
  async updateUser(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummary> {
    return this.access.updateUser(session.companyId, principal, userId, dto);
  }

  @Post('users/:userId/status')
  @RequirePermission('user', 'update')
  @HttpCode(HttpStatus.OK)
  async changeUserStatus(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('userId') userId: string,
    @Body() dto: ChangeUserStatusDto,
  ): Promise<void> {
    await this.access.changeUserStatus(session.companyId, principal.user.id, userId, dto.status);
  }

  @Get('users/:userId/sessions')
  @RequirePermission('user', 'manage')
  async listUserSessions(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<SessionInfo[]> {
    return this.access.listUserSessions(session.companyId, userId);
  }

  @Delete('users/:userId/sessions/:sessionId')
  @RequirePermission('user', 'manage')
  @HttpCode(HttpStatus.OK)
  async revokeUserSession(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.access.revokeUserSession(session.companyId, principal.user.id, userId, sessionId);
  }

  // ------------------------------------------------------------------ roles

  @Get('roles')
  @RequirePermission('role', 'view')
  async listRoles(@CurrentAuth() session: AuthenticatedRequest): Promise<RoleSummary[]> {
    return this.access.listRoles(session.companyId);
  }

  @Post('roles')
  @RequirePermission('role', 'create')
  @HttpCode(HttpStatus.OK)
  async createRole(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleSummary> {
    return this.access.createRole(session.companyId, principal, dto);
  }

  @Get('roles/:roleId')
  @RequirePermission('role', 'view')
  async getRole(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('roleId') roleId: string,
  ): Promise<RoleDetail> {
    return this.access.getRole(session.companyId, roleId);
  }

  @Patch('roles/:roleId')
  @RequirePermission('role', 'update')
  async updateRole(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleSummary> {
    return this.access.updateRole(session.companyId, principal.user.id, roleId, dto);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermission('role', 'update')
  @HttpCode(HttpStatus.OK)
  async replaceRolePermissions(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('roleId') roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
  ): Promise<RoleDetail> {
    return this.access.replaceRolePermissions(
      session.companyId,
      principal,
      roleId,
      dto.permissions,
    );
  }

  @Delete('roles/:roleId')
  @RequirePermission('role', 'delete')
  @HttpCode(HttpStatus.OK)
  async deleteRole(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.access.deleteRole(session.companyId, principal.user.id, roleId);
  }

  // ------------------------------------------------------------ permissions

  @Get('permissions')
  @RequirePermission('permission', 'view')
  async listPermissions(): Promise<PermissionRow[]> {
    return this.access.listPermissions();
  }
}
