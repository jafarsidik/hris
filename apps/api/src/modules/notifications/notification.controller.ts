import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';

import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationPreferenceReadModel,
  type NotificationReadModel,
  type NotificationTemplateReadModel,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { NotificationService } from './notification.service';

class PaginationQuery {
  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

class MarkReadParams {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class PreferencesUpdateItem {
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;
}

export class PreferencesUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferencesUpdateItem)
  items!: PreferencesUpdateItem[];
}

export class TemplateUpdateDto {
  @IsString()
  @IsNotEmpty()
  subjectTemplate!: string;

  @IsString()
  @IsNotEmpty()
  bodyTemplate!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class TemplateQuery {
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: NotificationChannel;
}

/**
 * Notification platform endpoints (System -> Communication, plus the bell).
 *
 * Recipient endpoints (feed, unread count, read state, own channel preferences)
 * require only authentication: they are scoped to the caller, so no resource grant
 * is meaningful. Template maintenance is company-scoped administration and is
 * gated on `notification:edit`.
 */
@Controller('notifications')
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly notifications: NotificationService) {}

  @Get('unread-count')
  async unreadCount(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<{ readonly count: number }> {
    const count = await this.notifications.unreadCount(session.companyId, session.userId);
    return { count };
  }

  @Get('preferences')
  async preferences(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<NotificationPreferenceReadModel[]> {
    return this.notifications.listPreferences(session.companyId, session.userId);
  }

  @Post('preferences')
  async updatePreferences(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() dto: PreferencesUpdateDto,
  ): Promise<NotificationPreferenceReadModel[]> {
    return this.notifications.updatePreferences(session.companyId, session.userId, dto.items);
  }

  @Get('templates')
  @RequirePermission('notification', 'view')
  async templates(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<NotificationTemplateReadModel[]> {
    return this.notifications.listTemplates(session.companyId);
  }

  @Post('templates/:eventKey')
  @RequirePermission('notification', 'update')
  async updateTemplate(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('eventKey') eventKey: NotificationEventKey,
    @Query() query: TemplateQuery,
    @Body() dto: TemplateUpdateDto,
  ): Promise<NotificationTemplateReadModel> {
    return this.notifications.updateTemplate(
      session.companyId,
      session.userId,
      eventKey,
      query.channel,
      dto,
    );
  }

  @Patch('read-all')
  async markAllRead(
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<{ readonly marked: number }> {
    return this.notifications.markAllRead(session.companyId, session.userId);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param() params: MarkReadParams,
  ): Promise<NotificationReadModel> {
    return this.notifications.markRead(session.companyId, session.userId, params.id);
  }

  @Get()
  async list(
    @CurrentAuth() session: AuthenticatedRequest,
    @Query() query: PaginationQuery,
  ): Promise<readonly NotificationReadModel[]> {
    return this.notifications.list(session.companyId, session.userId, normalisePageParams(query));
  }
}
