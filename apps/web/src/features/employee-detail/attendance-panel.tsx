import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import type { AttendanceSample } from './profile-extras';

const CELL_STATUS_CLASSES: Readonly<Record<AttendanceSample['days'][number]['status'], string>> = {
  present: 'bg-success/10 text-success',
  late: 'bg-warning/10 text-warning',
  leave: 'bg-info/10 text-info',
  absent: 'bg-destructive/10 text-destructive',
  off: 'border border-border text-muted-foreground',
  upcoming: 'bg-muted/50 text-muted-foreground opacity-50',
};

const CELL_STATUS_LABELS: Readonly<Record<AttendanceSample['days'][number]['status'], string>> = {
  present: 'Present',
  late: 'Late',
  leave: 'Leave',
  absent: 'Absent',
  off: 'Off',
  upcoming: '',
};

/**
 * The calendar and table of the profile's Attendance panel.
 *
 * Purely presentational sample data arrives computed from `profileExtrasFor`
 * (the module behind it is still planned), so this stays a server component.
 */
export function AttendancePanel({ attendance }: { attendance: AttendanceSample }) {
  const stats: { value: number; label: string }[] = [
    { value: attendance.counts.present, label: 'Present on time' },
    { value: attendance.counts.late, label: 'Late' },
    { value: attendance.counts.leave, label: 'On leave' },
    { value: attendance.counts.absent, label: 'Absent' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-muted/50 p-3.5">
            <b className="block text-xl font-semibold tabular-nums">{stat.value}</b>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold">Attendance calendar — {attendance.monthLabel}</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {attendance.headers.map((header) => (
          <div key={header} className="text-center text-xs font-semibold text-muted-foreground">
            {header}
          </div>
        ))}
        {Array.from({ length: attendance.leadingBlanks }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {attendance.days.map((cell) => (
          <div
            key={cell.day}
            className={cn(
              'min-h-14 rounded-lg p-1.5 text-xs',
              CELL_STATUS_CLASSES[cell.status],
              cell.day === attendance.todayDay && 'ring-2 ring-inset ring-ring',
            )}
          >
            <b className="block text-sm tabular-nums">{cell.day}</b>
            {CELL_STATUS_LABELS[cell.status]}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">Present</Badge>
        <Badge variant="warning">Late</Badge>
        <Badge variant="info">Leave</Badge>
        <Badge variant="destructive">Absent</Badge>
        <Badge variant="outline">Off</Badge>
      </div>

      <section className="border-t border-border pt-5">
        <h2 className="mb-4 text-base font-semibold">Recent attendance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Clock in</th>
                <th className="py-2 pr-4 font-medium">Clock out</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.entries.map((entry) => (
                <tr key={entry.label} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2.5 pr-4 font-medium">{entry.label}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{entry.inTime}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{entry.outTime}</td>
                  <td className="py-2.5">
                    <Badge variant={entry.variant}>{entry.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
