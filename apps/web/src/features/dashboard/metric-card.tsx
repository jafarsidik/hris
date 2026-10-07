import type { LucideIcon } from 'lucide-react';

/**
 * A single headline number on the command center.
 *
 * The value is a plain total and the footnote states the basis for it ("of 43 records"),
 * so a number is never presented as a fact the data cannot support. The icon chip is
 * decorative; the label text carries the meaning.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
