import type { ReactNode } from 'react';

/**
 * The title block at the top of a page.
 *
 * One component so that every page has a heading of the correct level and the same
 * vertical rhythm. The `<h1>` lives here rather than in each page because a page whose
 * heading is a `<h2>` — which the pre-shell pages were, since their only heading was
 * inside a `CardTitle` — leaves the document outline with no top-level heading.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  /** Controls rendered opposite the title, such as a primary action. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
