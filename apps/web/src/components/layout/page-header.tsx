import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The title block at the top of a page.
 *
 * One component so that every page has a heading of the correct level and the same
 * vertical rhythm. The `<h1>` lives here rather than in each page because a page whose
 * heading is a `<h2>` — which the pre-shell pages were, since their only heading was
 * inside a `CardTitle` — leaves the document outline with no top-level heading.
 *
 * The title **wraps rather than truncates**. A page title is the one string a reader
 * came for; an ellipsis on "API Documentation" or "Approval Authority" hides exactly the
 * words that distinguish one screen from its neighbour. Long titles take a second line;
 * `text-balance` keeps the two lines from being lopsided. On a narrow viewport the
 * actions drop below the title instead of compressing it, because a clipped action label
 * is worse than a taller header.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** Controls rendered opposite the title, such as a primary action. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-x-4 gap-y-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
