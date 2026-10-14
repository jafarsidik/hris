import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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

import {
  APPROVAL_SUBJECT_TYPES,
  type ApprovalAuthoritySummary,
  type ApprovalDelegationSummary,
  type ApprovalSubjectType,
} from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import {
  ApprovalService,
  type AuthorityInput,
  type AuthorityUpdateInput,
  type DelegationInput,
} from './approval.service';

export class CreateAuthorityDto {
  @IsIn(APPROVAL_SUBJECT_TYPES)
  subjectType!: ApprovalSubjectType;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  maxAmount?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateAuthorityDto {
  @IsOptional()
  @IsIn(APPROVAL_SUBJECT_TYPES)
  subjectType?: ApprovalSubjectType;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  maxAmount?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreateDelegationDto {
  @IsUUID()
  delegatorUserId!: string;

  @IsUUID()
  delegateeUserId!: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

/**
 * Approval authority (System -> Access Management).
 *
 * Company-scoped configuration gated on `approval-authority:*`. The rules are stored
 * and validated here; the M07 workflow engine is what will enforce them when routing
 * approvals.
 */
@Controller()
export class ApprovalController {
  constructor(@Inject(ApprovalService) private readonly approvals: ApprovalService) {}

  @Get('approval-authorities')
  @RequirePermission('approval-authority', 'view')
  async listAuthorities(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<ApprovalAuthoritySummary[]> {
    return this.approvals.listAuthorities(session.companyId);
  }

  @Post('approval-authorities')
  @RequirePermission('approval-authority', 'create')
  async createAuthority(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() dto: CreateAuthorityDto,
  ): Promise<ApprovalAuthoritySummary> {
    return this.approvals.createAuthority(session.companyId, session.userId, dto as AuthorityInput);
  }

  @Patch('approval-authorities/:authorityId')
  @RequirePermission('approval-authority', 'update')
  async updateAuthority(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('authorityId', new ParseUUIDPipe()) authorityId: string,
    @Body() dto: UpdateAuthorityDto,
  ): Promise<ApprovalAuthoritySummary> {
    return this.approvals.updateAuthority(
      session.companyId,
      session.userId,
      authorityId,
      dto as AuthorityUpdateInput,
    );
  }

  @Delete('approval-authorities/:authorityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('approval-authority', 'delete')
  async removeAuthority(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('authorityId', new ParseUUIDPipe()) authorityId: string,
  ): Promise<void> {
    await this.approvals.removeAuthority(session.companyId, session.userId, authorityId);
  }

  @Get('approval-delegations')
  @RequirePermission('approval-authority', 'view')
  async listDelegations(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<ApprovalDelegationSummary[]> {
    return this.approvals.listDelegations(session.companyId);
  }

  @Post('approval-delegations')
  @RequirePermission('approval-authority', 'create')
  async createDelegation(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() dto: CreateDelegationDto,
  ): Promise<ApprovalDelegationSummary> {
    return this.approvals.createDelegation(
      session.companyId,
      session.userId,
      dto as DelegationInput,
    );
  }

  @Delete('approval-delegations/:delegationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('approval-authority', 'delete')
  async removeDelegation(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('delegationId', new ParseUUIDPipe()) delegationId: string,
  ): Promise<void> {
    await this.approvals.removeDelegation(session.companyId, session.userId, delegationId);
  }
}
