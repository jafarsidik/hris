import type { ReactNode } from 'react';

import { SectionHeading } from '@/components/layout/section-heading';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * A titled region of a page, drawn as a white block.
 *
 * One primitive so every "section" reads the same way: a `bg-card` surface with a
 * border and radius (the block), a heading with an optional description and actions,
 * and a `<Separator>` between the heading and the body. Pages that used to hand-roll
 * `<section className="rounded-lg border p-4">` with a `SectionHeading` inside now
 * compose this instead, so the surface, the separator and the padding cannot drift
 * from one screen to the next.
 *
 * `title` is optional: a region that is already self-explanatory (a summary of a
 * record, say) renders the block and body without a header or separator rather than
 * inventing a heading for it.
 *
 * The heading level stays a parameter, exactly as in {@link SectionHeading}, so the
 * block can be a top-level section (`level={2}`) or a sub-section (`level={3}`)
 * without decoupling the visual weight from the document outline.
 */
export function Section({
  title,
  description,
  actions,
  level = 2,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** Controls rendered opposite the title, such as a section-scoped button. */
  actions?: ReactNode;
  level?: 2 | 3;
  className?: string;
  /** Escape hatch for a body that needs no padding, such as full-bleed divider rows. */
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = title !== undefined;

  return (
    <section
      data-slot="section"
      className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}
    >
      {hasHeader && (
        <>
          <div className="px-4 py-3 sm:px-5">
            <SectionHeading
              title={title}
              description={description}
              actions={actions}
              level={level}
            />
          </div>
          <Separator />
        </>
      )}
      <div className={cn('px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
    </section>
  );
}
