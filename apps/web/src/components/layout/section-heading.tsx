import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A heading for one region within a page.
 *
 * The page itself owns the only `<h1>` (see {@link PageHeader}); every section below it
 * is an `<h2>`, and a sub-section can pass `level={3}`. Keeping the level a parameter
 * rather than a styling choice means a section can look the same while the document
 * outline stays correct — the mistake the pre-shell pages made, where a styling class
 * decided the level and left the outline with no top-level heading.
 */
export function SectionHeading({
  title,
  description,
  actions,
  level = 2,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Controls rendered opposite the title, such as a section-scoped button. */
  actions?: ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = (level === 3 ? 'h3' : 'h2') as ElementType;

  return (
    <div
      data-slot="section-heading"
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}
    >
      <div className="min-w-0 space-y-1">
        <Heading
          className={cn('font-semibold tracking-tight', level === 3 ? 'text-sm' : 'text-base')}
        >
          {title}
        </Heading>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
