import { IsDateString, IsOptional, IsUUID } from 'class-validator';

import { Controller, Get, Inject, Query } from '@nestjs/common';

import { normalisePageParams, type Paginated } from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { ApiUsageService, type ApiRequestLogEntry, type ApiUsageReport } from './api-usage.service';

/** Query for the per-client usage rollup. */
export class ApiUsageQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}

/** Query for the paginated request log; adds the shared `limit`/`cursor` contract. */
export class ApiRequestsQueryDto extends ApiUsageQueryDto {
  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

/**
 * Read surface for developer API usage.
 *
 * Both endpoints are gated on `api-client.view`, the same permission the client list
 * uses, and every query is tenant-scoped by the RLS policy on `api_request_log`. This
 * controller only ever reads; rows are written by the request-usage middleware.
 */
@Controller('developers')
export class ApiUsageController {
  constructor(@Inject(ApiUsageService) private readonly usage: ApiUsageService) {}

  @Get('usage')
  @RequirePermission('api-client', 'view')
  async report(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query() query: ApiUsageQueryDto,
  ): Promise<ApiUsageReport> {
    return this.usage.usage(session.companyId, {
      from: query.from,
      to: query.to,
      clientId: query.clientId,
    });
  }

  @Get('requests')
  @RequirePermission('api-client', 'view')
  async requests(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query() query: ApiRequestsQueryDto,
  ): Promise<Paginated<ApiRequestLogEntry>> {
    return this.usage.requests(
      session.companyId,
      { from: query.from, to: query.to, clientId: query.clientId },
      normalisePageParams(query),
    );
  }
}
