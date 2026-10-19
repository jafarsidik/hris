import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
  type OffboardingCaseSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { OffboardingService } from './offboarding.service';

export class CreateOffboardingCaseDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsString()
  lastWorkingDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  exitInterviewNotes?: string | null;
}

export class OffboardingCaseQueryDto {
  @IsOptional()
  @IsIn(['INITIATED', 'IN_CLEARANCE', 'CLEARED', 'COMPLETED'])
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

export class SetChecklistItemDoneDto {
  @IsString()
  @MinLength(1)
  done!: string;
}

/**
 * Offboarding administration.
 *
 * Reads require `offboarding:view`; case mutations additionally require
 * company-wide scope inside the service.
 */
@Controller('offboarding')
export class OffboardingController {
  constructor(@Inject(OffboardingService) private readonly offboarding: OffboardingService) {}

  @Get('cases')
  @RequirePermission('offboarding', 'view')
  async listCases(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: OffboardingCaseQueryDto,
  ): Promise<Paginated<OffboardingCaseSummary>> {
    return this.offboarding.listCases(
      session.companyId,
      principal,
      query,
      normalisePageParams(query),
    );
  }

  @Post('cases')
  @RequirePermission('offboarding', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createCase(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateOffboardingCaseDto,
  ): Promise<OffboardingCaseSummary> {
    return this.offboarding.createCase(session.companyId, principal, {
      employeeId: dto.employeeId,
      reason: dto.reason,
      lastWorkingDate: dto.lastWorkingDate,
      exitInterviewNotes: dto.exitInterviewNotes ?? null,
    });
  }

  @Post('cases/:id/advance')
  @RequirePermission('offboarding', 'update')
  async advanceCase(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<OffboardingCaseSummary> {
    return this.offboarding.advanceCase(session.companyId, principal, id);
  }

  @Post('checklist-items/:id/done')
  @RequirePermission('offboarding', 'update')
  async setChecklistItemDone(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: SetChecklistItemDoneDto,
  ): Promise<void> {
    await this.offboarding.setChecklistItemDone(
      session.companyId,
      principal,
      id,
      dto.done === 'true',
    );
  }
}
