import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The state a screen shows when a request succeeded but returned nothing.
 *
 * Distinct from {@link ErrorPanel} on purpose. "No employees match this filter" and
 * "the employee service is down" are different facts, and collapsing them into one
 * neutral-looking panel is how users learn to ignore error states.
 *
 * The icon is decorative: the heading already carries the meaning, so the icon is
 * hidden from assistive technology rather than announced as an unlabelled graphic.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description !== undefined && (
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="pt-1">{action}</div>}
    </div>
  );
}
