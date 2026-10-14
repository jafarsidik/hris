import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Shared password policy (brief, Authentication):
 * 8-128 characters, at least one lowercase letter, one uppercase letter and one digit.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

@ValidatorConstraint({ name: 'isHrisPassword', async: false })
class HrisPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      value.length >= PASSWORD_MIN_LENGTH &&
      value.length <= PASSWORD_MAX_LENGTH &&
      PASSWORD_COMPLEXITY.test(value)
    );
  }

  defaultMessage(_args: ValidationArguments): string {
    return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and contain at least one uppercase letter, one lowercase letter and one digit.`;
  }
}

export function IsHrisPassword(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      constraints: [],
      validator: HrisPasswordConstraint,
    });
  };
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString()
  @IsHrisPassword()
  password!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(10, { message: 'The invitation link looks incomplete.' })
  @MaxLength(300)
  inviteToken!: string;

  @IsString()
  @IsHrisPassword()
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(10, { message: 'The reset link looks incomplete.' })
  @MaxLength(300)
  token!: string;

  @IsString()
  @IsHrisPassword()
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsHrisPassword()
  currentPassword!: string;

  @IsString()
  @IsHrisPassword()
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  token!: string;
}

export class MfaVerifyDto {
  @IsString()
  @MinLength(10, { message: 'The sign-in challenge looks incomplete.' })
  @MaxLength(300)
  challengeToken!: string;

  @IsString()
  @MinLength(6, { message: 'Enter the 6-digit code or a recovery code.' })
  @MaxLength(32)
  code!: string;
}
