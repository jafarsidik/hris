import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { palette, radii, spacing, typography } from '../tokens';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

const TONE_STYLES: Readonly<Record<BadgeTone, CSSProperties>> = Object.freeze({
  neutral: { backgroundColor: palette.neutral100, color: palette.neutral700 },
  info: { backgroundColor: palette.primarySoft, color: palette.primary },
  success: { backgroundColor: '#dcfce7', color: palette.success },
  warning: { backgroundColor: '#fef3c7', color: palette.warning },
  danger: { backgroundColor: palette.dangerSoft, color: palette.danger },
});

/**
 * Status pill.
 *
 * Colour is never the only carrier of meaning: the label text always states the
 * status, which keeps the component usable in high-contrast and monochrome
 * settings.
 */
export function Badge({ tone = 'neutral', className, style, children }: BadgeProps): ReactElement {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: radii.pill,
        whiteSpace: 'nowrap',
        ...TONE_STYLES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
