import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
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
  Put,
  Query,
} from '@nestjs/common';

import {
  INTEGRATION_KINDS,
  type DeliveryLogEntry,
  type IntegrationHealthSummary,
  type IntegrationKind,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { IntegrationsService, type IntegrationActor } from './integrations.service';

export class CreateIntegrationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(INTEGRATION_KINDS as readonly string[])
  kind!: IntegrationKind;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  provider!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  events?: string[];
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(INTEGRATION_KINDS as readonly string[])
  kind?: IntegrationKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

/** Replaces a webhook endpoint's full subscription set. */
export class SetSubscriptionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  events!: string[];
}

function actor(session: AuthenticatedRequest, principal: SessionPrincipal): IntegrationActor {
  return { companyId: session.companyId, userId: principal.user.id };
}

/**
 * Integration registry.
 *
 * Reads require `integration:view`; create/update/delete require the matching action.
 * Running a connection test is gated on `integration:manage` because it reaches out to
 * an external system and can be used to probe the network. Adapter configuration is
 * validated to reject secret-like keys, so credentials stay in System Settings.
 */
@Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Get()
  @RequirePermission('integration', 'view')
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
  ) {
    return this.integrations.list(session.companyId, principal);
  }

  /**
   * Literal segments are declared ahead of `:id`: Nest matches in declaration order, and
   * `@Get(':id')` registered first would capture `deliveries`/`monitor` as an id (there is
   * no ParseUUIDPipe here to reject them), so these routes would never be reached.
   */
  @Get('deliveries')
  @RequirePermission('integration', 'view')
  async deliveryLog(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ): Promise<readonly DeliveryLogEntry[]> {
    const parsed = limit === undefined ? 100 : Number.parseInt(limit, 10);
    return this.integrations.listDeliveryLog(
      session.companyId,
      Number.isFinite(parsed) ? parsed : 100,
    );
  }

  @Get('monitor')
  @RequirePermission('integration', 'view')
  async monitor(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<readonly IntegrationHealthSummary[]> {
    return this.integrations.monitor(session.companyId);
  }

  @Get(':id')
  @RequirePermission('integration', 'view')
  async get(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.integrations.get(session.companyId, principal, id);
  }

  @Post()
  @RequirePermission('integration', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrations.create(actor(session, principal), dto);
  }

  @Patch(':id')
  @RequirePermission('integration', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrations.update(actor(session, principal), id, dto);
  }

  @Delete(':id')
  @RequirePermission('integration', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.integrations.remove(actor(session, principal), id);
  }

  @Post(':id/test')
  @RequirePermission('integration', 'manage')
  @HttpCode(HttpStatus.OK)
  async test(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.integrations.testConnection(actor(session, principal), id);
  }

  @Get(':id/deliveries')
  @RequirePermission('integration', 'view')
  async deliveries(@CurrentAuth() session: AuthenticatedRequest, @Param('id') id: string) {
    return this.integrations.listDeliveries(session.companyId, id);
  }

  @Get(':id/subscriptions')
  @RequirePermission('integration', 'view')
  async subscriptions(@CurrentAuth() session: AuthenticatedRequest, @Param('id') id: string) {
    return this.integrations.listSubscriptions(session.companyId, id);
  }

  @Put(':id/subscriptions')
  @RequirePermission('integration', 'update')
  async setSubscriptions(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: SetSubscriptionsDto,
  ) {
    return this.integrations.replaceSubscriptions(actor(session, principal), id, dto.events);
  }

  /**
   * Mints a fresh signing secret and returns it exactly once. Gated on `manage` rather
   * than `update` because rotating the secret invalidates every in-flight verification
   * at the receiver until they adopt the new value.
   */
  @Post(':id/secret')
  @RequirePermission('integration', 'manage')
  @HttpCode(HttpStatus.OK)
  async rotateSecret(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ) {
    return this.integrations.rotateWebhookSecret(actor(session, principal), id);
  }
}
