import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
  type LeavePolicySummary,
  type LeaveRequestSummary,
  type LeaveTypeSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { LeaveService } from './leave.service';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  isPaid?: boolean;

  @IsOptional()
  @IsString()
  defaultDays?: number;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  isPaid?: boolean;

  @IsOptional()
  @IsString()
  defaultDays?: number;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class LeaveTypeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsString()
  isActive?: boolean;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class CreateLeavePolicyDto {
  @IsString()
  @IsUUID()
  leaveTypeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  annualDays!: string;

  @IsOptional()
  @IsString()
  carryForward?: boolean;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class UpdateLeavePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  annualDays?: string;

  @IsOptional()
  @IsString()
  carryForward?: boolean;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class LeavePolicyQueryDto {
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsString()
  isActive?: boolean;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class CreateLeaveRequestDto {
  @IsString()
  @IsUUID()
  employeeId!: string;

  @IsString()
  @IsUUID()
  leaveTypeId!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: string;
}

export class LeaveRequestQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

/**
 * Leave domain administration.
 *
 * Reads require `leave:view`; mutations require the matching action. Leave request
 * status transitions (approve/reject) additionally require `leave.approve` when
 * acting on another employee's request.
 */
@Controller('leave')
export class LeaveController {
  constructor(@Inject(LeaveService) private readonly leave: LeaveService) {}

  // -- Leave types -----------------------------------------------------------

  @Get('types')
  @RequirePermission('leave', 'view')
  async listTypes(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: LeaveTypeQueryDto,
  ): Promise<Paginated<LeaveTypeSummary>> {
    return this.leave.listLeaveTypes(
      session.companyId,
      principal,
      {
        search: query.search,
        isActive: query.isActive,
      },
      normalisePageParams(query),
    );
  }

  @Post('types')
  @RequirePermission('leave', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createType(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateLeaveTypeDto,
  ): Promise<LeaveTypeSummary> {
    return this.leave.createLeaveType(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      isPaid: dto.isPaid ?? true,
      defaultDays: dto.defaultDays ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  @Patch('types/:id')
  @RequirePermission('leave', 'update')
  async updateType(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeSummary> {
    return this.leave.updateLeaveType(session.companyId, principal, id, {
      name: dto.name,
      description: dto.description,
      isPaid: dto.isPaid,
      defaultDays: dto.defaultDays,
      isActive: dto.isActive,
    });
  }

  @Delete('types/:id')
  @RequirePermission('leave', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteType(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.leave.deleteLeaveType(session.companyId, principal, id);
  }

  // -- Leave policies --------------------------------------------------------

  @Get('policies')
  @RequirePermission('leave', 'view')
  async listPolicies(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: LeavePolicyQueryDto,
  ): Promise<Paginated<LeavePolicySummary>> {
    return this.leave.listLeavePolicies(
      session.companyId,
      principal,
      {
        leaveTypeId: query.leaveTypeId,
        isActive: query.isActive,
      },
      normalisePageParams(query),
    );
  }

  @Post('policies')
  @RequirePermission('leave', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createPolicy(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateLeavePolicyDto,
  ): Promise<LeavePolicySummary> {
    return this.leave.createLeavePolicy(session.companyId, principal, {
      leaveTypeId: dto.leaveTypeId,
      annualDays: Number(dto.annualDays),
      carryForward: dto.carryForward ?? false,
      isActive: dto.isActive ?? true,
    });
  }

  @Patch('policies/:id')
  @RequirePermission('leave', 'update')
  async updatePolicy(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLeavePolicyDto,
  ): Promise<LeavePolicySummary> {
    return this.leave.updateLeavePolicy(session.companyId, principal, id, {
      annualDays: dto.annualDays === undefined ? undefined : Number(dto.annualDays),
      carryForward: dto.carryForward,
      isActive: dto.isActive,
    });
  }

  @Delete('policies/:id')
  @RequirePermission('leave', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePolicy(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.leave.deleteLeavePolicy(session.companyId, principal, id);
  }

  // -- Leave requests --------------------------------------------------------

  @Get('requests')
  @RequirePermission('leave', 'view')
  async listRequests(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: LeaveRequestQueryDto,
  ): Promise<Paginated<LeaveRequestSummary>> {
    return this.leave.listLeaveRequests(
      session.companyId,
      principal,
      {
        employeeId: query.employeeId,
        leaveTypeId: query.leaveTypeId,
        status: query.status,
        search: query.search,
      },
      normalisePageParams(query),
    );
  }

  @Get('requests/:id')
  @RequirePermission('leave', 'view')
  async getRequest(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<LeaveRequestSummary> {
    return this.leave.getLeaveRequest(session.companyId, principal, id);
  }

  @Post('requests')
  @RequirePermission('leave', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestSummary> {
    return this.leave.createLeaveRequest(session.companyId, principal, {
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason ?? null,
    });
  }

  @Patch('requests/:id')
  @RequirePermission('leave', 'update')
  async updateRequest(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveRequestDto,
  ): Promise<LeaveRequestSummary> {
    return this.leave.updateLeaveRequest(session.companyId, principal, id, {
      startDate: dto.startDate,
      endDate: dto.endDate,
      days: dto.days,
      reason: dto.reason,
      status: dto.status,
    });
  }

  @Delete('requests/:id')
  @RequirePermission('leave', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRequest(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.leave.deleteLeaveRequest(session.companyId, principal, id);
  }
}
