import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { palette, spacing, typography } from '../tokens';

export type TextTone = 'default' | 'muted' | 'danger' | 'success' | 'warning';
export type TextVariant = 'body' | 'caption' | 'subtitle' | 'title';

export interface TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly weight?: keyof typeof typography.fontWeight;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

const TONE_COLORS: Readonly<Record<TextTone, string>> = Object.freeze({
  default: palette.neutral800,
  muted: palette.neutral500,
  danger: palette.danger,
  success: palette.success,
  warning: palette.warning,
});

const VARIANT_STYLES: Readonly<Record<TextVariant, CSSProperties>> = Object.freeze({
  body: { margin: 0, fontSize: typography.fontSize.md, lineHeight: typography.lineHeight.normal },
  caption: {
    margin: 0,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.normal,
  },
  subtitle: {
    margin: 0,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.normal,
  },
  title: {
    margin: 0,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.tight,
  },
});

const TEXT_ELEMENTS: Readonly<Record<TextVariant, 'p' | 'span' | 'h3'>> = Object.freeze({
  body: 'p',
  caption: 'span',
  subtitle: 'p',
  title: 'h3',
});

/**
 * Typography primitive.
 *
 * `title` renders a heading element so that document structure is preserved;
 * every other variant renders non-semantic text.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  weight = 'regular',
  className,
  style,
  children,
}: TextProps): ReactElement {
  const Element = TEXT_ELEMENTS[variant];

  return (
    <Element
      className={className}
      style={{
        fontFamily: typography.fontFamily,
        color: TONE_COLORS[tone],
        fontWeight: typography.fontWeight[weight],
        ...(variant === 'title' ? { marginBottom: spacing.sm } : {}),
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    >
      {children}
    </Element>
  );
}