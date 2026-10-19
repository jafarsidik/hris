import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  Body,
  Controller,
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
  type Paginated,
  type PerformanceCycleSummary,
  type PerformanceGoalSummary,
  type PerformanceReviewSummary,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { PerformanceService } from './performance.service';

export class CreateCycleDto {
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
}

export class CreateGoalDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description!: string | null;

  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;
}

export class UpdateGoalProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number;
}

export class CreateReviewDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary!: string | null;
}

export class GoalQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'ACHIEVED'])
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

export class ReviewQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsIn(['SUBMITTED'])
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
 * Performance administration.
 *
 * Reads require `performance:view`; goal and review writes are additionally
 * scope-checked in the service. Cycle management needs company-wide scope.
 */
@Controller('performance')
export class PerformanceController {
  constructor(@Inject(PerformanceService) private readonly performance: PerformanceService) {}

  // -- Cycles -----------------------------------------------------------------

  @Get('cycles')
  @RequirePermission('performance', 'view')
  async listCycles(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: { limit?: number; cursor?: string },
  ): Promise<Paginated<PerformanceCycleSummary>> {
    return this.performance.listCycles(session.companyId, principal, normalisePageParams(query));
  }

  @Post('cycles')
  @RequirePermission('performance', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createCycle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateCycleDto,
  ): Promise<PerformanceCycleSummary> {
    return this.performance.createCycle(session.companyId, principal, {
      code: dto.code,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Post('cycles/:id/advance')
  @RequirePermission('performance', 'update')
  async advanceCycle(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<PerformanceCycleSummary> {
    return this.performance.advanceCycle(session.companyId, principal, id);
  }

  // -- Goals ------------------------------------------------------------------

  @Get('goals')
  @RequirePermission('performance', 'view')
  async listGoals(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: GoalQueryDto,
  ): Promise<Paginated<PerformanceGoalSummary>> {
    return this.performance.listGoals(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('goals')
  @RequirePermission('performance', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createGoal(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateGoalDto,
  ): Promise<PerformanceGoalSummary> {
    return this.performance.createGoal(session.companyId, principal, {
      cycleId: dto.cycleId,
      employeeId: dto.employeeId,
      title: dto.title,
      description: dto.description ?? null,
      weight: dto.weight,
    });
  }

  @Patch('goals/:id/progress')
  @RequirePermission('performance', 'update')
  async updateGoalProgress(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateGoalProgressDto,
  ): Promise<PerformanceGoalSummary> {
    return this.performance.updateGoalProgress(session.companyId, principal, id, dto.progress);
  }

  // -- Reviews ----------------------------------------------------------------

  @Get('reviews')
  @RequirePermission('performance', 'view')
  async listReviews(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: ReviewQueryDto,
  ): Promise<Paginated<PerformanceReviewSummary>> {
    return this.performance.listReviews(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('reviews')
  @RequirePermission('performance', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateReviewDto,
  ): Promise<PerformanceReviewSummary> {
    return this.performance.createReview(session.companyId, principal, {
      cycleId: dto.cycleId,
      employeeId: dto.employeeId,
      rating: dto.rating ?? null,
      summary: dto.summary ?? null,
    });
  }
}
