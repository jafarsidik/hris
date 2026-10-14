import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { CurrentPrincipal } from '../../common/auth/current.decorator';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import { MfaService } from './mfa.service';

export class EnableMfaDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class ConfirmMfaDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}

/**
 * Multi-factor authentication for the signed-in user (System -> Security).
 *
 * Every route operates on the caller's own account, so only authentication is
 * required: holding the session is the authority to manage its own factors.
 */
@Controller('mfa')
export class MfaController {
  constructor(@Inject(MfaService) private readonly mfa: MfaService) {}

  @Get('status')
  async status(@CurrentPrincipal() principal: SessionPrincipal) {
    return this.mfa.getStatus(principal.user.companyId, principal.user.id);
  }

  @Post('enroll')
  async enroll(@CurrentPrincipal() principal: SessionPrincipal, @Body() dto: EnableMfaDto) {
    return this.mfa.beginEnrollment(
      principal.user.companyId,
      principal.user.id,
      principal.user.email,
      dto.label ?? 'Authenticator app',
    );
  }

  @Post('enroll/:factorId/confirm')
  async confirm(
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('factorId') factorId: string,
    @Body() dto: ConfirmMfaDto,
  ) {
    return this.mfa.confirmEnrollment(
      principal.user.companyId,
      principal.user.id,
      factorId,
      dto.code,
    );
  }

  @Post('recovery-codes')
  async recoveryCodes(@CurrentPrincipal() principal: SessionPrincipal) {
    return this.mfa.regenerateRecoveryCodes(principal.user.companyId, principal.user.id);
  }

  @Post('disable')
  async disable(
    @CurrentPrincipal() principal: SessionPrincipal,
  ): Promise<{ readonly disabled: true }> {
    await this.mfa.disable(principal.user.companyId, principal.user.id);
    return { disabled: true };
  }
}
