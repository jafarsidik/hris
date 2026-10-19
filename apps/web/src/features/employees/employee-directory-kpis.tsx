'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import type { Employee } from '@/features/employees/employee-types';

/**
 * The directory's KPI strip: total, active, on leave and recently joined.
 *
 * Mirrors the reference screen's summary cards. The counts are computed from the rows
 * the page loaded — the same window the table shows — so a card never claims a number
 * the directory cannot drill into. Clicking Active or On leave narrows the directory
 * by status through the URL filter; clicking again clears it.
 */
export function EmployeeDirectoryKpis({
  rows,
  activeStatus,
  today = new Date(),
}: {
  rows: readonly Employee[];
  /** The URL-pinned status filter the table opened with, or '' for all. */
  activeStatus?: string;
  today?: Date;
}) {
  const active = rows.filter((row) => row.status === 'ACTIVE').length;
  const onLeave = rows.filter((row) => row.status === 'ON_LEAVE').length;
  const recent90 = 90 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = today.getTime() - recent90;
  const recent = rows.filter((row) => {
    const joined = new Date(`${row.hireDate}T00:00:00.000Z`).getTime();
    return !Number.isNaN(joined) && joined >= ninetyDaysAgo && joined <= today.getTime();
  }).length;

  const cards: readonly {
    readonly key: string;
    readonly label: string;
    readonly count: number;
    readonly note: string;
    readonly emph?: 'ok' | 'wn';
    readonly status?: string;
  }[] = [
    { key: 'total', label: 'Total employees', count: rows.length, note: 'All records in view' },
    {
      key: 'active',
      label: 'Active',
      count: active,
      note: 'Currently working',
      emph: 'ok',
      status: 'ACTIVE',
    },
    {
      key: 'leave',
      label: 'On leave',
      count: onLeave,
      note: 'On leave right now',
      emph: 'wn',
      status: 'ON_LEAVE',
    },
    { key: 'recent', label: 'New joiners', count: recent, note: 'Last 90 days' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const isOn = card.status !== undefined && activeStatus === card.status;
        const body = (
          <>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {card.label}
              {card.emph !== undefined && (
                <span
                  data-em={card.emph}
                  className={cn(
                    'font-semibold',
                    card.emph === 'ok' ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {isOn ? '· filtered' : ''}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">
              {card.count}
            </div>
            <div className="text-xs text-muted-foreground">{card.note}</div>
          </>
        );

        if (card.status === undefined) {
          return (
            <div key={card.key} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              {body}
            </div>
          );
        }

        // Narrows through the URL so the server page runs the filtered query: the
        // same handshake the table's own deep links use.
        return (
          <Link
            key={card.key}
            href={isOn ? '/employees' : `/employees?status=${card.status}`}
            className={cn(
              'rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none',
              isOn ? 'ring-2 ring-ring' : 'hover:bg-muted/40',
            )}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
