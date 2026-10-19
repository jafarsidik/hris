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
  type AttendanceRecordSummary,
  type Paginated,
  type ShiftPatternSummary,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { AttendanceService } from './attendance.service';

export class CreateAttendanceRecordDto {
  @IsString()
  @IsUUID()
  employeeId!: string;

  @IsString()
  attendanceDate!: string;

  @IsOptional()
  @IsString()
  clockIn?: string | null;

  @IsOptional()
  @IsString()
  clockOut?: string | null;

  @IsOptional()
  @IsString()
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateAttendanceRecordDto {
  @IsOptional()
  @IsString()
  clockIn?: string | null;

  @IsOptional()
  @IsString()
  clockOut?: string | null;

  @IsOptional()
  @IsString()
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class AttendanceRecordQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'])
  status?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class CreateShiftPatternDto {
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

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsString()
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  workDays?: string;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class UpdateShiftPatternDto {
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
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  workDays?: string;

  @IsOptional()
  @IsString()
  isActive?: boolean;
}

export class ShiftPatternQueryDto {
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

/**
 * Attendance & Time administration.
 *
 * Reads require `attendance:view`; mutations require the matching action.
 * Attendance record creation outside `self` scope requires `attendance:create`.
 */
@Controller('attendance')
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendance: AttendanceService) {}

  // -- Attendance records ----------------------------------------------------

  @Get('records')
  @RequirePermission('attendance', 'view')
  async listRecords(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: AttendanceRecordQueryDto,
  ): Promise<Paginated<AttendanceRecordSummary>> {
    return this.attendance.listAttendanceRecords(
      session.companyId,
      principal,
      {
        employeeId: query.employeeId,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
        search: query.search,
      },
      normalisePageParams(query),
    );
  }

  @Get('records/:id')
  @RequirePermission('attendance', 'view')
  async getRecord(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<AttendanceRecordSummary> {
    return this.attendance.getAttendanceRecord(session.companyId, principal, id);
  }

  @Post('records')
  @RequirePermission('attendance', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createRecord(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateAttendanceRecordDto,
  ): Promise<AttendanceRecordSummary> {
    return this.attendance.createAttendanceRecord(session.companyId, principal, {
      employeeId: dto.employeeId,
      attendanceDate: dto.attendanceDate,
      clockIn: dto.clockIn ?? null,
      clockOut: dto.clockOut ?? null,
      breakMinutes: dto.breakMinutes,
      status: dto.status,
      notes: dto.notes,
    });
  }

  @Patch('records/:id')
  @RequirePermission('attendance', 'update')
  async updateRecord(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceRecordDto,
  ): Promise<AttendanceRecordSummary> {
    return this.attendance.updateAttendanceRecord(session.companyId, principal, id, {
      clockIn: dto.clockIn,
      clockOut: dto.clockOut,
      breakMinutes: dto.breakMinutes,
      status: dto.status,
      notes: dto.notes,
    });
  }

  @Delete('records/:id')
  @RequirePermission('attendance', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRecord(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.attendance.deleteAttendanceRecord(session.companyId, principal, id);
  }

  // -- Shift patterns --------------------------------------------------------

  @Get('shift-patterns')
  @RequirePermission('attendance', 'view')
  async listShiftPatterns(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: ShiftPatternQueryDto,
  ): Promise<Paginated<ShiftPatternSummary>> {
    return this.attendance.listShiftPatterns(
      session.companyId,
      principal,
      {
        search: query.search,
        isActive: query.isActive,
      },
      normalisePageParams(query),
    );
  }

  @Get('shift-patterns/:id')
  @RequirePermission('attendance', 'view')
  async getShiftPattern(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<ShiftPatternSummary> {
    return this.attendance.getShiftPattern(session.companyId, principal, id);
  }

  @Post('shift-patterns')
  @RequirePermission('attendance', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createShiftPattern(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateShiftPatternDto,
  ): Promise<ShiftPatternSummary> {
    return this.attendance.createShiftPattern(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakMinutes: dto.breakMinutes ?? 0,
      workDays: dto.workDays ?? '1,2,3,4,5',
      isActive: dto.isActive ?? true,
    });
  }

  @Patch('shift-patterns/:id')
  @RequirePermission('attendance', 'update')
  async updateShiftPattern(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateShiftPatternDto,
  ): Promise<ShiftPatternSummary> {
    return this.attendance.updateShiftPattern(session.companyId, principal, id, {
      name: dto.name,
      description: dto.description,
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakMinutes: dto.breakMinutes,
      workDays: dto.workDays,
      isActive: dto.isActive,
    });
  }

  @Delete('shift-patterns/:id')
  @RequirePermission('attendance', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShiftPattern(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.attendance.deleteShiftPattern(session.companyId, principal, id);
  }
}
