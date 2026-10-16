import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { EventRegistrySnapshot } from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { EventsService } from './events.service';

/** The default page of recent events, and the ceiling a caller cannot exceed. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class ListEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? DEFAULT_LIMIT : Number(value)))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;
}

/**
 * The Event Registry.
 *
 * This is the automation-facing view of domain events, distinct from the audit log in
 * the System module: the audit log records *who did what* for compliance, while this
 * records *what the platform emitted* so a rule, workflow or webhook can react. Reads
 * need `workflow:view`; retrying a delivery is a state change and needs `workflow:manage`.
 */
@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @RequirePermission('workflow', 'view')
  async snapshot(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query() query: ListEventsQueryDto,
  ): Promise<EventRegistrySnapshot> {
    return this.events.snapshot(session.companyId, {
      type: query.type,
      resource: query.resource,
      resourceId: query.resourceId,
      pendingOnly: query.pendingOnly === true,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('workflow', 'manage')
  async retry(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.events.retry(session.companyId, id);
  }
}
