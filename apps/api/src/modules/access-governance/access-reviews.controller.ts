import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { AccessReviewsService } from './access-reviews.service';
import type { AccessReviewSummary } from '@hris/shared-types';

export class CreateAccessReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class PatchAccessReviewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class DecideItemDto {
  @IsString()
  @IsIn(['APPROVED', 'REVOKED', 'NO_ACTION'])
  decision!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

@Controller('access-reviews')
export class AccessReviewsController {
  constructor(@Inject(AccessReviewsService) private readonly reviews: AccessReviewsService) {}

  @Get()
  @RequirePermission('registry', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<AccessReviewSummary[]> {
    return this.reviews.list(session.companyId);
  }

  @Get(':id')
  @RequirePermission('registry', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AccessReviewSummary & { items: unknown }> {
    return this.reviews.get(session.companyId, id);
  }

  @Post()
  @RequirePermission('registry', 'manage')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() body: CreateAccessReviewDto,
  ): Promise<AccessReviewSummary> {
    return this.reviews.create(
      { companyId: session.companyId, userId: principal.user.id },
      {
        name: body.name,
        description: body.description ?? null,
        reviewerId: body.reviewerId ?? principal.user.id,
        dueAt: body.dueAt ?? null,
      },
    );
  }

  @Patch(':id')
  @RequirePermission('registry', 'manage')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchAccessReviewDto,
  ): Promise<AccessReviewSummary> {
    return this.reviews.update(
      { companyId: session.companyId, userId: principal.user.id },
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('registry', 'manage')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.reviews.remove({ companyId: session.companyId, userId: principal.user.id }, id);
  }

  @Post(':reviewId/items/:itemId/decide')
  @RequirePermission('registry', 'manage')
  async decideItem(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() body: DecideItemDto,
  ): Promise<void> {
    await this.reviews.decideItem(
      { companyId: session.companyId, userId: principal.user.id },
      reviewId,
      itemId,
      body.decision,
      body.notes ?? null,
    );
  }
}
