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
  Post,
  Query,
} from '@nestjs/common';

import {
  type JobApplicationSummary,
  type JobRequisitionSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RecruitmentService } from './recruitment.service';

export class CreateRequisitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsUUID()
  positionId!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  department!: string | null;

  @IsInt()
  @Min(1)
  @Max(999)
  headcount!: number;
}

export class CreateApplicationDto {
  @IsUUID()
  requisitionId!: string;

  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes!: string | null;
}

export class RequisitionQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'FILLED', 'CLOSED'])
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

export class ApplicationQueryDto {
  @IsOptional()
  @IsUUID()
  requisitionId?: string;

  @IsOptional()
  @IsIn(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'])
  stage?: string;

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
 * Recruitment administration.
 *
 * Reads require `recruitment:view`; mutations also require a resolvable
 * write scope inside the service.
 */
@Controller('recruitment')
export class RecruitmentController {
  constructor(@Inject(RecruitmentService) private readonly recruitment: RecruitmentService) {}

  // -- Requisitions ------------------------------------------------------------

  @Get('requisitions')
  @RequirePermission('recruitment', 'view')
  async listRequisitions(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: RequisitionQueryDto,
  ): Promise<Paginated<JobRequisitionSummary>> {
    return this.recruitment.listRequisitions(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('requisitions')
  @RequirePermission('recruitment', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createRequisition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateRequisitionDto,
  ): Promise<JobRequisitionSummary> {
    return this.recruitment.createRequisition(session.companyId, principal, {
      code: dto.code,
      title: dto.title,
      positionId: dto.positionId ?? null,
      department: dto.department ?? null,
      headcount: dto.headcount,
    });
  }

  @Post('requisitions/:id/advance')
  @RequirePermission('recruitment', 'update')
  async advanceRequisition(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<JobRequisitionSummary> {
    return this.recruitment.advanceRequisition(session.companyId, principal, id);
  }

  // -- Applications ------------------------------------------------------------

  @Get('applications')
  @RequirePermission('recruitment', 'view')
  async listApplications(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: ApplicationQueryDto,
  ): Promise<Paginated<JobApplicationSummary>> {
    return this.recruitment.listApplications(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('applications')
  @RequirePermission('recruitment', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createApplication(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateApplicationDto,
  ): Promise<JobApplicationSummary> {
    return this.recruitment.createApplication(session.companyId, principal, {
      requisitionId: dto.requisitionId,
      candidateId: dto.candidateId,
      notes: dto.notes ?? null,
    });
  }

  @Post('applications/:id/advance')
  @RequirePermission('recruitment', 'update')
  async advanceApplication(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<JobApplicationSummary> {
    return this.recruitment.advanceApplication(session.companyId, principal, id);
  }
}
