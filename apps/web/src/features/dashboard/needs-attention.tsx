import Link from 'next/link';
import { ArrowRight, CircleAlert, CircleCheck, Hourglass, Plane, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { computeDirectoryFacts } from '@/features/employees/directory-facts';
import type { Employee } from '@/features/employees/employee-types';
import { cn } from '@/lib/utils';

/**
 * The "needs attention" panel on the command center.
 *
 * Only facts the directory can actually support appear here — on leave, probation, a
 * confirmation window, recent joiners — each linking to the filtered directory that
 * proves it. No contracts, documents or certifications exist yet, so nothing about them is
 * invented to fill the panel. Every figure shares {@link computeDirectoryFacts} with the
 * KPI row and the notification bell, so the three surfaces cannot disagree.
 */

type Tone = 'warning' | 'success' | 'info';

const TONE_CLASSES: Readonly<Record<Tone, string>> = {
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  info: 'bg-muted text-muted-foreground',
};

interface AttentionRow {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly count: number;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
}

export function NeedsAttention({ employees }: { employees: readonly Employee[] }) {
  const facts = computeDirectoryFacts(employees);

  const rows: AttentionRow[] = [
    {
      key: 'on-leave',
      label: 'Employees on leave',
      description: 'Status ON_LEAVE in the directory',
      count: facts.onLeave,
      href: '/employees?status=ON_LEAVE',
      icon: Plane,
      tone: 'warning',
    },
    {
      key: 'probation',
      label: 'Employees in probation',
      description: 'Confirmation decisions sit beside these records',
      count: facts.probation,
      href: '/employees?status=PROBATION',
      icon: Hourglass,
      tone: 'info',
    },
    {
      key: 'confirming-soon',
      label: 'Probation ends within 30 days',
      description: 'Six-month window from the hire date',
      count: facts.confirmingSoon,
      href: '/employees?status=PROBATION',
      icon: CircleAlert,
      tone: 'warning',
    },
    {
      key: 'joiners',
      label: 'Joined in the last 30 days',
      description: 'Newest records in the directory',
      count: facts.recentJoiners,
      href: '/employees',
      icon: UserPlus,
      tone: 'success',
    },
  ];

  const visible = rows.filter((row) => row.count > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>
            <h2>Needs attention</h2>
          </CardTitle>
          <CardDescription>Derived from the directory</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline" className="tabular-nums">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="p-0">
        {visible.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-6">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-success/10 text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
            </span>
            <p className="text-sm text-muted-foreground">Nothing currently requires attention.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map(({ key, label, description, count, href, icon: Icon, tone }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-md',
                      TONE_CLASSES[tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{count}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
