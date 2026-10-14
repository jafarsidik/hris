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

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { RecordsService, type ResourceRecordSummary } from './records.service';

/**
 * Generic CRUD endpoints for registry-declared resources.
 *
 * The resource is named in the URL, so authorization cannot be declared with a static
 * `@RequirePermission`; it is resolved by `RecordsService` from the caller's live
 * permissions on every request. The routes themselves still sit behind the global
 * authentication guard.
 */
@Controller('records')
export class RecordsController {
  constructor(@Inject(RecordsService) private readonly records: RecordsService) {}

  @Get(':resource')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: readonly ResourceRecordSummary[] }> {
    const parsed = limit === undefined ? 50 : Number.parseInt(limit, 10);
    const items = await this.records.list(
      session.companyId,
      principal,
      resource,
      Number.isNaN(parsed) ? 50 : parsed,
    );
    return { items };
  }

  @Get(':resource/:id')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ): Promise<ResourceRecordSummary> {
    return this.records.get(session.companyId, principal, resource, id);
  }

  @Post(':resource')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ResourceRecordSummary> {
    return this.records.create(session.companyId, principal, resource, body);
  }

  @Patch(':resource/:id')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ResourceRecordSummary> {
    return this.records.update(session.companyId, principal, resource, id, body);
  }

  @Delete(':resource/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.records.remove(session.companyId, principal, resource, id);
  }

  @Post(':resource/:id/actions/:action')
  @HttpCode(HttpStatus.OK)
  async runAction(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ record: ResourceRecordSummary; result: unknown }> {
    return this.records.runAction(session.companyId, principal, resource, id, action, body);
  }
}
