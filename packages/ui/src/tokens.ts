import type { CSSProperties } from 'react';

/**
 * Design tokens.
 *
 * A single source of truth for visual constants so that the web app and the
 * design system cannot drift. Tokens are plain typed objects rather than CSS
 * custom properties so that they are consumed identically from TypeScript
 * (including the mobile application) and are checked by the compiler.
 */

export const palette = Object.freeze({
  neutral0: '#ffffff',
  neutral50: '#f8fafc',
  neutral100: '#f1f5f9',
  neutral200: '#e2e8f0',
  neutral300: '#cbd5e1',
  neutral400: '#94a3b8',
  neutral500: '#64748b',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1e293b',
  neutral900: '#0f172a',
  primary: '#1d4ed8',
  primaryHover: '#1e40af',
  primarySoft: '#dbeafe',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  success: '#15803d',
  warning: '#b45309',
  onPrimary: '#ffffff',
});

export const spacing = Object.freeze({
  none: '0',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  xxl: '2rem',
});

export const radii = Object.freeze({
  sm: '4px',
  md: '6px',
  lg: '10px',
  pill: '999px',
});

export const typography = Object.freeze({
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: Object.freeze({
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  }),
  fontWeight: Object.freeze({
    regular: 400,
    medium: 500,
    bold: 700,
  }),
  lineHeight: Object.freeze({
    tight: 1.25,
    normal: 1.5,
  }),
});

export const elevation = Object.freeze({
  none: 'none',
  sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
  md: '0 4px 12px rgba(15, 23, 42, 0.10)',
});

export const focusRing = '0 0 0 3px rgba(29, 78, 216, 0.45)';

export const tokens = Object.freeze({
  palette,
  spacing,
  radii,
  typography,
  elevation,
});

/** Visible focus indicator required for WCAG 2.1 AA keyboard navigation. */
export const accessibleFocusStyle: CSSProperties = Object.freeze({
  outline: 'none',
  boxShadow: focusRing,
});
