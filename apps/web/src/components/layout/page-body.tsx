import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The content column of a page.
 *
 * Every screen renders its header and sections inside one `PageBody`, so the vertical
 * rhythm between a page title, its toolbar and its sections is the same everywhere. The
 * gap is a single source of truth rather than a `gap-4` here and a `gap-6` there — the
 * two values the screens had grown into, which made two equally-tall pages breathe
 * differently for no reason a reader could name.
 *
 * `gap-6` (24px) separates major regions; finer spacing belongs inside each region
 * (a `PageToolbar` sits closer to the table it controls than to the previous section).
 */
export function PageBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>;
}
