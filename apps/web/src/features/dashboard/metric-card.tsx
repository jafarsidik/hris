import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The tint a metric card takes. Deliberately a small, semantic set. */
type MetricTone = 'primary' | 'success' | 'warning' | 'info';

/*
 * One place that maps a tone to its surface and foreground classes, so a card's accent
 * bar and its icon chip can never drift to two different colours.
 */
const TONE_CLASSES: Record<MetricTone, { bar: string; chip: string }> = {
  primary: { bar: 'bg-primary', chip: 'bg-primary/10 text-primary' },
  success: { bar: 'bg-success', chip: 'bg-success/10 text-success' },
  warning: { bar: 'bg-warning', chip: 'bg-warning/10 text-warning' },
  info: { bar: 'bg-info', chip: 'bg-info/10 text-info' },
};

/**
 * A single headline number on the command center.
 *
 * The value is a plain total and the footnote states the basis for it ("of 43 records"),
 * so a number is never presented as a fact the data cannot support. The icon chip is
 * decorative; the label text carries the meaning.
 *
 * `tone` colours the card's cap and icon chip so the KPI row reads as a set of distinct
 * measures rather than six identical grey boxes. It carries no semantic weight the label
 * does not already state — colour is reinforcement, not information.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: number;
  sub: string;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  const colors = TONE_CLASSES[tone];

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', colors.bar)} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          aria-hidden="true"
          className={cn('grid size-7 shrink-0 place-items-center rounded-md', colors.chip)}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
