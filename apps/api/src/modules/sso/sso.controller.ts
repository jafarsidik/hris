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
import type { Request, Response } from 'express';

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
  Query,
  Req,
  Res,
} from '@nestjs/common';

import {
  IDENTITY_PROVIDER_TYPES,
  type IdentityProviderSummary,
  type IdentityProviderType,
  type SsoProviderDescriptor,
  type SsoStartResponse,
} from '@hris/shared-types';

import type { AppConfiguration } from '../../config/app-configuration';
import { APP_CONFIG } from '../../config/app-configuration.module';
import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithCorrelationId } from '../../common/http/correlation-id.middleware';
import { SsoService, type ProviderCreateInput, type ProviderUpdateInput } from './sso.service';
import type { SamlHttpRequest } from './sso.types';

class OidcSettingsDto {
  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

class SamlSettingsDto {
  @IsString()
  @IsNotEmpty()
  entryPoint!: string;

  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  idpCert!: string;

  @IsOptional()
  @IsString()
  idpEntityId?: string;
}

export class CreateIdentityProviderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(IDENTITY_PROVIDER_TYPES)
  type!: IdentityProviderType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OidcSettingsDto)
  oidc?: OidcSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SamlSettingsDto)
  saml?: SamlSettingsDto;
}

export class UpdateIdentityProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OidcSettingsDto)
  oidc?: OidcSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SamlSettingsDto)
  saml?: SamlSettingsDto;
}

class ProvidersQuery {
  @IsOptional()
  @IsString()
  email?: string;
}

/**
 * Identity providers (System -> Security) and the public SSO sign-in flow.
 *
 * Administration is company-scoped and gated on `identity-provider:*`. The three
 * `auth/sso/*` routes are `@Public` on purpose: they run before a session exists.
 */
@Controller()
export class SsoController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(SsoService) private readonly sso: SsoService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public sign-in flow
  // ---------------------------------------------------------------------------

  @Public()
  @Get('auth/sso/providers')
  async providers(@Query() query: ProvidersQuery): Promise<SsoProviderDescriptor[]> {
    return this.sso.providersForEmail(query.email ?? '');
  }

  @Public()
  @Get('auth/sso/:providerId/start')
  async start(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
  ): Promise<SsoStartResponse> {
    return this.sso.start(providerId);
  }

  @Public()
  @Get('auth/sso/:providerId/callback')
  async oidcCallback(
    @Req() request: RequestWithCorrelationId & Request,
    @Res() response: Response,
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
    @Query() query: Record<string, string>,
  ): Promise<void> {
    const result = await this.sso.completeOidc(providerId, query, this.contextFrom(request));
    this.persistSessionCookie(response, result.token, result.expiresAt);
    response.redirect(this.successRedirect());
  }

  @Public()
  @Post('auth/sso/:providerId/callback')
  @HttpCode(HttpStatus.FOUND)
  async samlCallback(
    @Req() request: RequestWithCorrelationId & Request,
    @Res() response: Response,
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
  ): Promise<void> {
    const http: SamlHttpRequest = {
      httpMethod: 'POST',
      query: this.stringRecord(request.query),
      body: this.stringRecord(request.body),
    };
    const result = await this.sso.completeSaml(providerId, http, this.contextFrom(request));
    this.persistSessionCookie(response, result.token, result.expiresAt);
    response.redirect(this.successRedirect());
  }

  // ---------------------------------------------------------------------------
  // Administration
  // ---------------------------------------------------------------------------

  @Get('identity-providers')
  @RequirePermission('identity-provider', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest): Promise<IdentityProviderSummary[]> {
    return this.sso.list(session.companyId);
  }

  @Post('identity-providers')
  @RequirePermission('identity-provider', 'create')
  async create(
    @CurrentAuth() session: AuthenticatedRequest,
    @Body() dto: CreateIdentityProviderDto,
  ): Promise<IdentityProviderSummary> {
    return this.sso.create(session.companyId, session.userId, dto as ProviderCreateInput);
  }

  @Patch('identity-providers/:providerId')
  @RequirePermission('identity-provider', 'update')
  async update(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
    @Body() dto: UpdateIdentityProviderDto,
  ): Promise<IdentityProviderSummary> {
    return this.sso.update(
      session.companyId,
      session.userId,
      providerId,
      dto as ProviderUpdateInput,
    );
  }

  @Delete('identity-providers/:providerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('identity-provider', 'delete')
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
  ): Promise<void> {
    await this.sso.remove(session.companyId, session.userId, providerId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private contextFrom(request: Request & Partial<RequestWithCorrelationId>) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.correlationId,
    };
  }

  private successRedirect(): string {
    return `${this.config.webAppUrl.replace(/\/$/, '')}/login?sso=success`;
  }

  private persistSessionCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.config.auth.cookieName, token, {
      httpOnly: true,
      secure: this.config.environment === 'production',
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
  }

  private stringRecord(input: unknown): Record<string, string> {
    if (typeof input !== 'object' || input === null) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }
}
