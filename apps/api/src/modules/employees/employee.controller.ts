import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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
  Query,
} from '@nestjs/common';

import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type EmployeeSummary,
  type PositionSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { EmployeeService } from './employee.service';

export class CreateEmployeeDto {
  /** When blank the service resolves (or mints) the backing user from `userEmail`. */
  @IsOptional()
  @IsString()
  userId!: string;

  /** Empty means the service allocates the next number for the company. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeNumber!: string;

  /** The display name for a minted backing user; ignored when `userId` is set. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  userName?: string;

  /** The login/email for a minted backing user; must be unique per company. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  userEmail?: string;

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsString()
  @IsIn([...EMPLOYMENT_TYPES])
  employmentType!: string;

  @IsString()
  @IsIn([...EMPLOYEE_STATUSES])
  status!: string;

  @IsString()
  hireDate!: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeNumber?: string;

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  terminationDate?: string | null;
}

export class EmployeeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employmentType?: string;

  @IsOptional()
  @IsIn(['name', 'hireDate'])
  sort?: 'name' | 'hireDate';

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class CreatePositionDto {
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
  @IsUUID()
  organizationalUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobGrade?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePositionDto {
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
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  organizationalUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobGrade?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PositionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsString()
  isActive?: boolean;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

/**
 * Employee master data administration.
 *
 * Reads require `employee:view`; mutations require the matching action. The
 * caller's data scope narrows every read to the employees they may see, so a
 * delegated administrator cannot enumerate a sibling subtree.
 */
@Controller('employees')
export class EmployeeController {
  constructor(@Inject(EmployeeService) private readonly employees: EmployeeService) {}

  // -- Employees -------------------------------------------------------------

  @Get()
  @RequirePermission('employee', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeQueryDto,
  ): Promise<Paginated<EmployeeSummary>> {
    return this.employees.listEmployees(
      session.companyId,
      principal,
      {
        search: query.search,
        status: query.status,
        department: query.department,
        employmentType: query.employmentType,
        sort: query.sort,
      },
      normalisePageParams(query),
    );
  }

  // -- Positions -------------------------------------------------------------

  @Get('positions')
  @RequirePermission('organization', 'view')
  async listPositions(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: PositionQueryDto,
  ): Promise<Paginated<PositionSummary>> {
    return this.employees.listPositions(
      session.companyId,
      principal,
      {
        search: query.search,
        unitId: query.unitId,
        isActive: query.isActive,
      },
      normalisePageParams(query),
    );
  }

  @Get('positions/:id')
  @RequirePermission('organization', 'view')
  async getPosition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<PositionSummary> {
    return this.employees.getPosition(session.companyId, principal, id);
  }

  @Post('positions')
  @RequirePermission('organization', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createPosition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreatePositionDto,
  ): Promise<PositionSummary> {
    return this.employees.createPosition(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      organizationalUnitId: dto.organizationalUnitId ?? null,
      jobGrade: dto.jobGrade ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  @Patch('positions/:id')
  @RequirePermission('organization', 'update')
  async updatePosition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ): Promise<PositionSummary> {
    return this.employees.updatePosition(session.companyId, principal, id, {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      organizationalUnitId: dto.organizationalUnitId ?? null,
      jobGrade: dto.jobGrade,
      isActive: dto.isActive ?? true,
    });
  }

  @Delete('positions/:id')
  @RequirePermission('organization', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePosition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.employees.deletePosition(session.companyId, principal, id);
  }

  // -- Employees by id: parameterised routes LAST, so literal siblings such as
  // 'positions' and other controllers' literal paths ('contacts','family',
  // 'contracts','movements') are never swallowed by this ':' catch-all:
  // Express matches routes in registration order and a bare ':id' accepts words.
  @Get(':id')
  @RequirePermission('employee', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<EmployeeSummary> {
    return this.employees.getEmployee(session.companyId, principal, id);
  }

  @Post()
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateEmployeeDto,
  ): Promise<EmployeeSummary> {
    return this.employees.createEmployee(session.companyId, principal, {
      userId: dto.userId,
      employeeNumber: dto.employeeNumber,
      userName: dto.userName,
      userEmail: dto.userEmail,
      organizationalUnitId: dto.organizationalUnitId ?? null,
      positionId: dto.positionId ?? null,
      employmentType: dto.employmentType,
      status: dto.status,
      hireDate: dto.hireDate,
    });
  }

  @Patch(':id')
  @RequirePermission('employee', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeSummary> {
    return this.employees.updateEmployee(session.companyId, principal, id, {
      employeeNumber: dto.employeeNumber,
      organizationalUnitId: dto.organizationalUnitId,
      positionId: dto.positionId,
      employmentType: dto.employmentType,
      status: dto.status,
      hireDate: dto.hireDate,
      terminationDate: dto.terminationDate,
    });
  }

  @Delete(':id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.employees.deleteEmployee(session.companyId, principal, id);
  }
}
