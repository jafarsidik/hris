import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The row of controls above a table or list: search, filters and primary actions.
 *
 * One wrapper so every list page puts those controls in the same place with the same
 * wrapping behaviour. It is deliberately *not* a flex-direction container with a fixed
 * alignment: callers place a search input, then filters, then actions, and `flex-wrap`
 * lets the row fall onto a second line on narrow viewports instead of overflowing. A
 * caller that wants the primary action pushed to the end adds `justify-end` via
 * `className`.
 */
export function PageToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-slot="page-toolbar" className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}
