import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactElement } from 'react';

import { accessibleFocusStyle, palette, radii, spacing, typography } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Disables interaction and exposes `aria-busy` to assistive technology. */
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
}

const VARIANT_STYLES: Readonly<Record<ButtonVariant, CSSProperties>> = Object.freeze({
  primary: {
    backgroundColor: palette.primary,
    color: palette.onPrimary,
    borderColor: palette.primary,
  },
  secondary: {
    backgroundColor: palette.neutral0,
    color: palette.neutral800,
    borderColor: palette.neutral300,
  },
  danger: {
    backgroundColor: palette.danger,
    color: palette.onPrimary,
    borderColor: palette.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: palette.primary,
    borderColor: 'transparent',
  },
});

const SIZE_STYLES: Readonly<Record<ButtonSize, CSSProperties>> = Object.freeze({
  sm: { padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.fontSize.xs },
  md: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.fontSize.sm },
  lg: { padding: `${spacing.md} ${spacing.xl}`, fontSize: typography.fontSize.md },
});

/**
 * Primary interactive control.
 *
 * Consumers may override the base styles via `style`; the caller's `style` is
 * merged last so intent always wins.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled = false,
    style,
    type = 'button',
    children,
    ...rest
  },
  ref,
): ReactElement {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        fontFamily: typography.fontFamily,
        fontWeight: typography.fontWeight.medium,
        lineHeight: typography.lineHeight.normal,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderRadius: radii.md,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        width: fullWidth ? '100%' : undefined,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...accessibleFocusStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
});