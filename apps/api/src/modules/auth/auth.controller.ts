import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { CurrentSession, SessionInfo } from '@hris/shared-types';

import type { AppConfiguration } from '../../config/app-configuration';
import { APP_CONFIG } from '../../config/app-configuration.module';
import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import { type AuthenticatedRequest } from '../../common/auth/request-auth';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithCorrelationId } from '../../common/http/correlation-id.middleware';
// A value import on purpose, not `import type`: TypeScript elides type-only imports, so
// `design:paramtypes` would emit `Function` for `@Body() dto: LoginDto`. Nest would then
// validate against a class that owns no rules, `forbidNonWhitelisted` would reject every
// field as "property ... should not exist", and each of these endpoints would answer 400
// VALIDATION_ERROR for a perfectly valid payload. The DTOs are classes; the reference has
// to survive emit for the global ValidationPipe to see the decorators.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- see above; `import type` breaks validation at runtime
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MfaVerifyDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { AuthService, type LoginContext } from './auth.service';

/**
 * Authentication and session endpoints (brief, Authentication).
 *
 * Sign-in hands the opaque token to the caller twice: in the httpOnly session cookie
 * (the browser transport, ADR 0010) and in the response body (so non-cookie clients
 * such as mobile or test harnesses can use the identical token as a Bearer credential).
 * `POST /logout`, `POST /change-password` and the session-management routes are
 * state-changing, so the CSRF guard requires the same-origin header when they are
 * called with a cookie session.
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfiguration,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: RequestWithCorrelationId & Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: LoginDto,
  ): Promise<
    | { mfaRequired: false; token: string; expiresAt: string; session: CurrentSession }
    | { mfaRequired: true; challengeToken: string; expiresAt: string }
  > {
    const result = await this.auth.login(dto.email, dto.password, this.contextFrom(request));

    if (result.mfaRequired) {
      return {
        mfaRequired: true,
        challengeToken: result.challengeToken,
        expiresAt: result.expiresAt.toISOString(),
      };
    }

    this.persistSessionCookie(response, result.token, result.expiresAt);
    return {
      mfaRequired: false,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      session: result.session,
    };
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Req() request: RequestWithCorrelationId & Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: MfaVerifyDto,
  ): Promise<{ mfaRequired: false; token: string; expiresAt: string; session: CurrentSession }> {
    const result = await this.auth.verifyMfaChallenge(
      dto.challengeToken,
      dto.code,
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: RequestWithCorrelationId & Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.logout(
      session.tokenHash,
      session.companyId,
      session.userId,
      this.contextFrom(request),
    );
    this.clearSessionCookie(response);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: SessionPrincipal): Promise<CurrentSession> {
    // The principal is resolved fresh on every request by the guard, so this is a
    // zero-extra-database-read mirror of the caller.
    return this.auth.me(principal);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Req() request: RequestWithCorrelationId & Request,
    @Body() dto: RegisterDto,
  ): Promise<void> {
    await this.auth.register(dto.inviteToken, dto.password, this.contextFrom(request));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Req() request: RequestWithCorrelationId & Request,
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const message = await this.auth.requestPasswordReset(dto.email, this.contextFrom(request));
    return { message };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Req() request: RequestWithCorrelationId & Request,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.newPassword, this.contextFrom(request));
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Req() request: RequestWithCorrelationId & Request,
    @Body() dto: VerifyEmailDto,
  ): Promise<void> {
    await this.auth.verifyEmail(dto.token, this.contextFrom(request));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() request: RequestWithCorrelationId & Request,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(
      principal,
      dto.currentPassword,
      dto.newPassword,
      this.contextFrom(request),
    );
  }

  @Get('sessions')
  async listSessions(
    @CurrentPrincipal() principal: SessionPrincipal,
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<SessionInfo[]> {
    return this.auth.listSessions(principal, session.sessionId);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @Req() request: RequestWithCorrelationId & Request,
    @CurrentPrincipal() principal: SessionPrincipal,
    @CurrentAuth() session: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.revokeOtherSessions(principal, session.sessionId, this.contextFrom(request));
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Req() request: RequestWithCorrelationId & Request,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.auth.revokeSession(principal, sessionId, this.contextFrom(request));
  }

  private contextFrom(request: RequestWithCorrelationId & Request): LoginContext {
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

  private clearSessionCookie(response: Response): void {
    response.clearCookie(this.config.auth.cookieName, {
      httpOnly: true,
      secure: this.config.environment === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}
