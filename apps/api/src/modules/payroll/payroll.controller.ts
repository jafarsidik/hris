import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import {
  type Paginated,
  type PayrollPeriodSummary,
  type PayrollRunSummary,
  type SalaryStructureSummary,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { PayrollService } from './payroll.service';

export class CreatePayrollPeriodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  payDate?: string | null;
}

export class CreateSalaryStructureDto {
  @IsString()
  @IsUUID()
  positionId!: string;

  @IsNumber()
  @IsPositive()
  baseSalary!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string | null;
}

export class PayrollComponentInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  component!: string;

  @IsNumber()
  amount!: number;
}

export class CalculatePayrollRunDto {
  @IsString()
  @IsUUID()
  periodId!: string;

  @IsString()
  @IsUUID()
  employeeId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PayrollComponentInputDto)
  components!: PayrollComponentInputDto[];
}

export class PayrollPeriodQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'PROCESSING', 'APPROVED', 'PAID', 'CLOSED'])
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

export class SalaryStructureQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class PayrollRunQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'PAID'])
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
 * Payroll administration.
 *
 * Reads require `payroll:view`; mutations additionally require company-wide
 * scope (`all`) inside the service.
 */
@Controller('payroll')
export class PayrollController {
  constructor(@Inject(PayrollService) private readonly payroll: PayrollService) {}

  // -- Periods ----------------------------------------------------------------

  @Get('periods')
  @RequirePermission('payroll', 'view')
  async listPeriods(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: PayrollPeriodQueryDto,
  ): Promise<Paginated<PayrollPeriodSummary>> {
    return this.payroll.listPeriods(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('periods')
  @RequirePermission('payroll', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createPeriod(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreatePayrollPeriodDto,
  ): Promise<PayrollPeriodSummary> {
    return this.payroll.createPeriod(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      payDate: dto.payDate ?? null,
    });
  }

  @Post('periods/:id/advance')
  @RequirePermission('payroll', 'update')
  async advancePeriod(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<PayrollPeriodSummary> {
    return this.payroll.advancePeriod(session.companyId, principal, id);
  }

  // -- Salary structures ------------------------------------------------------

  @Get('salary-structures')
  @RequirePermission('payroll', 'view')
  async listSalaryStructures(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: SalaryStructureQueryDto,
  ): Promise<Paginated<SalaryStructureSummary>> {
    return this.payroll.listSalaryStructures(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('salary-structures')
  @RequirePermission('payroll', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createSalaryStructure(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateSalaryStructureDto,
  ): Promise<SalaryStructureSummary> {
    return this.payroll.createSalaryStructure(session.companyId, principal, {
      positionId: dto.positionId,
      baseSalary: dto.baseSalary,
      currency: dto.currency ?? 'IDR',
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      isActive: true,
    });
  }

  // -- Payroll runs -----------------------------------------------------------

  @Get('runs')
  @RequirePermission('payroll', 'view')
  async listRuns(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: PayrollRunQueryDto,
  ): Promise<Paginated<PayrollRunSummary>> {
    return this.payroll.listRuns(session.companyId, principal, query, normalisePageParams(query));
  }

  @Post('runs/calculate')
  @RequirePermission('payroll', 'create')
  @HttpCode(HttpStatus.CREATED)
  async calculateRun(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CalculatePayrollRunDto,
  ): Promise<PayrollRunSummary> {
    return this.payroll.calculateRun(session.companyId, principal, {
      periodId: dto.periodId,
      employeeId: dto.employeeId,
      components: dto.components,
    });
  }

  @Post('runs/:id/advance')
  @RequirePermission('payroll', 'update')
  async advanceRun(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<PayrollRunSummary> {
    return this.payroll.advanceRun(session.companyId, principal, id);
  }
}
