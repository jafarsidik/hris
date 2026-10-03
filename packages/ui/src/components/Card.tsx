import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { elevation, palette, radii, spacing, typography } from '../tokens';

export interface CardProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly footer?: ReactNode;
  /** Removes internal padding for edge-to-edge content such as tables. */
  readonly flush?: boolean;
  readonly elevated?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

/**
 * Surface container used by dashboards, forms and detail pages.
 *
 * When a `title` is supplied the heading is rendered as an `h2` so that the
 * document outline stays navigable by screen reader users.
 */
export function Card({
  title,
  subtitle,
  footer,
  flush = false,
  elevated = false,
  className,
  style,
  children,
}: CardProps): ReactElement {
  const hasHeader = title !== undefined || subtitle !== undefined;

  return (
    <section
      className={className}
      style={{
        fontFamily: typography.fontFamily,
        backgroundColor: palette.neutral0,
        border: `1px solid ${palette.neutral200}`,
        borderRadius: radii.lg,
        boxShadow: elevated ? elevation.md : elevation.sm,
        ...style,
      }}
    >
      {hasHeader ? (
        <header
          style={{
            padding: flush ? `${spacing.lg} ${spacing.lg} 0` : spacing.xl,
            borderBottom: `1px solid ${palette.neutral100}`,
          }}
        >
          {title !== undefined ? (
            <h2
              style={{
                margin: 0,
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: palette.neutral900,
              }}
            >
              {title}
            </h2>
          ) : null}
          {subtitle !== undefined ? (
            <p
              style={{
                margin: `${spacing.xs} 0 0`,
                fontSize: typography.fontSize.sm,
                color: palette.neutral500,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      <div style={{ padding: flush ? 0 : spacing.xl }}>{children}</div>

      {footer !== undefined ? (
        <footer
          style={{
            padding: spacing.lg,
            borderTop: `1px solid ${palette.neutral100}`,
            backgroundColor: palette.neutral50,
            borderBottomLeftRadius: radii.lg,
            borderBottomRightRadius: radii.lg,
          }}
        >
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
