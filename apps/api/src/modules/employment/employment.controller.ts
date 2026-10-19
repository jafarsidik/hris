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
  type EmployeeMovementSummary,
  type EmploymentContractSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { EmploymentService } from './employment.service';

export class EmploymentQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  probation?: string;
}

export class ContractBodyDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  contractNumber!: string;

  @IsString()
  @IsIn(['PERMANENT', 'FIXED_TERM', 'PROBATION', 'INTERNSHIP'])
  contractType!: string;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsString()
  @IsIn(['ACTIVE', 'EXPIRED', 'TERMINATED'])
  status!: string;

  @IsOptional()
  @IsString()
  signedDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class MovementBodyDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  @IsIn(['TRANSFER', 'PROMOTION', 'CHANGE'])
  movementType!: string;

  @IsString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fromUnitName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toUnitName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fromPositionName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toPositionName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

/**
 * Employment agreements and organizational movements.
 *
 * Every route requires `employee:view`; mutations additionally require
 * company-wide scope (checked inside the service).
 */
@Controller('employees')
export class EmploymentController {
  constructor(@Inject(EmploymentService) private readonly service: EmploymentService) {}

  private query(query: EmploymentQueryDto) {
    return normalisePageParams(query);
  }

  // -- Contracts ----------------------------------------------------------------

  @Get('contracts')
  @RequirePermission('employee', 'view')
  listContracts(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmploymentQueryDto,
  ): Promise<Paginated<EmploymentContractSummary>> {
    return this.service.listContracts(
      session.companyId,
      principal,
      query,
      this.query(query),
      query.probation === 'true',
    );
  }

  @Post('contracts')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createContract(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: ContractBodyDto,
  ): Promise<EmploymentContractSummary> {
    return this.service.createContract(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      contractNumber: dto.contractNumber,
      contractType: dto.contractType,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      status: dto.status,
      signedDate: dto.signedDate ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Patch('contracts/:id')
  @RequirePermission('employee', 'update')
  updateContract(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: ContractBodyDto,
  ): Promise<EmploymentContractSummary> {
    return this.service.updateContract(session.companyId, principal, id, {
      contractNumber: dto.contractNumber,
      contractType: dto.contractType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: dto.status,
      signedDate: dto.signedDate,
      notes: dto.notes,
    });
  }

  @Delete('contracts/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContract(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.removeContract(session.companyId, principal, id);
  }

  // -- Movements ----------------------------------------------------------------

  @Get('movements')
  @RequirePermission('employee', 'view')
  listMovements(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmploymentQueryDto,
  ): Promise<Paginated<EmployeeMovementSummary>> {
    return this.service.listMovements(session.companyId, principal, query, this.query(query));
  }

  @Post('movements')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createMovement(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: MovementBodyDto,
  ): Promise<EmployeeMovementSummary> {
    return this.service.createMovement(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      movementType: dto.movementType,
      effectiveDate: dto.effectiveDate,
      fromUnitName: dto.fromUnitName ?? null,
      toUnitName: dto.toUnitName ?? null,
      fromPositionName: dto.fromPositionName ?? null,
      toPositionName: dto.toPositionName ?? null,
      reason: dto.reason ?? null,
    });
  }

  @Patch('movements/:id')
  @RequirePermission('employee', 'update')
  updateMovement(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: MovementBodyDto,
  ): Promise<EmployeeMovementSummary> {
    return this.service.updateMovement(session.companyId, principal, id, {
      movementType: dto.movementType,
      effectiveDate: dto.effectiveDate,
      fromUnitName: dto.fromUnitName,
      toUnitName: dto.toUnitName,
      fromPositionName: dto.fromPositionName,
      toPositionName: dto.toPositionName,
      reason: dto.reason,
    });
  }

  @Delete('movements/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMovement(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.removeMovement(session.companyId, principal, id);
  }
}
