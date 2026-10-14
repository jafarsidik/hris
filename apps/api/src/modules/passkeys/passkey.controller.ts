import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import type { Request, Response } from 'express';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import type { CurrentSession, PasskeySummary } from '@hris/shared-types';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { CurrentPrincipal } from '../../common/auth/current.decorator';
import type { RequestWithCorrelationId } from '../../common/http/correlation-id.middleware';
import { Public } from '../../common/decorators/public.decorator';
import { PasskeyService } from './passkey.service';

export class RegistrationVerifyDto {
  @IsObject()
  response!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class AuthenticationOptionsDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}

export class AuthenticationVerifyDto {
  @IsObject()
  response!: Record<string, unknown>;
}

/**
 * Passkeys (System -> Security).
 *
 * Listing, registration and deletion are self-service for the signed-in user. The two
 * `auth/passkeys/*` routes are `@Public` because they establish the session they run
 * without one.
 */
@Controller()
export class PasskeyController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(PasskeyService) private readonly passkeys: PasskeyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public sign-in flow
  // ---------------------------------------------------------------------------

  @Public()
  @Post('auth/passkeys/authentication/options')
  @HttpCode(200)
  async authenticationOptions(
    @Body() dto: AuthenticationOptionsDto,
  ): Promise<Record<string, unknown>> {
    return this.passkeys.authenticationOptions(dto.email);
  }

  @Public()
  @Post('auth/passkeys/authentication/verify')
  @HttpCode(200)
  async verifyAuthentication(
    @Req() request: RequestWithCorrelationId & Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: AuthenticationVerifyDto,
  ): Promise<{ mfaRequired: false; token: string; expiresAt: string; session: CurrentSession }> {
    const result = await this.passkeys.verifyAuthentication(
      dto.response,
      this.contextFrom(request),
    );
    this.persistSessionCookie(response, result.token, result.expiresAt);
    return {
      mfaRequired: false,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      session: result.session,
    };
  }

  // ---------------------------------------------------------------------------
  // Self-service management
  // ---------------------------------------------------------------------------

  @Get('passkeys')
  async list(@CurrentPrincipal() principal: SessionPrincipal): Promise<PasskeySummary[]> {
    return this.passkeys.list(principal.user.companyId, principal.user.id);
  }

  @Post('passkeys/registration/options')
  async registrationOptions(
    @CurrentPrincipal() principal: SessionPrincipal,
  ): Promise<Record<string, unknown>> {
    return this.passkeys.registrationOptions(
      principal.user.companyId,
      principal.user.id,
      principal.user.email,
      principal.user.displayName,
    );
  }

  @Post('passkeys/registration/verify')
  async verifyRegistration(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: RegistrationVerifyDto,
  ) {
    return this.passkeys.verifyRegistration(
      principal.user.companyId,
      principal.user.id,
      dto.response,
      dto.deviceName ?? null,
    );
  }

  @Delete('passkeys/:passkeyId')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('passkeyId', new ParseUUIDPipe()) passkeyId: string,
  ): Promise<void> {
    await this.passkeys.remove(principal.user.companyId, principal.user.id, passkeyId);
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

  private persistSessionCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.config.auth.cookieName, token, {
      httpOnly: true,
      secure: this.config.environment === 'production',
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
  }
}
