import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Employee } from '@/features/employees/employee-types';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 128;
const BAR_GUTTER = 4;
const PLOT_TOP = 12;
const PLOT_HEIGHT = 96;
const MAX_BARS = 6;

/**
 * Headcount by department, drawn as a small SVG bar chart.
 *
 * Deliberately library-free: a single static chart on a dashboard does not justify a
 * graphing dependency, and an SVG whose geometry is computed in the render below is
 * crisp at any pixel ratio and unchanged between renders — the dataset is identical
 * every server start, so the picture must be too.
 *
 * The chart carries a text summary as its accessible name; no screen reader is going to
 * parse two dozen `<rect>` elements into "Finance has eleven people".
 */
export function HrSampleCard({ employees }: { employees: readonly Employee[] }) {
  const counts = new Map<string, number>();
  for (const employee of employees) {
    counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
  }

  const entries = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_BARS);

  const max = Math.max(1, ...entries.map(([, count]) => count));
  const barWidth = (CHART_WIDTH - BAR_GUTTER * (entries.length - 1)) / Math.max(1, entries.length);
  const summary = entries.map(([label, count]) => `${label} ${count}`).join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Headcount by department</h2>
        </CardTitle>
        <CardDescription>Where the current records sit</CardDescription>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records to chart.</p>
        ) : (
          <figure>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label={`Headcount by department: ${summary}.`}
              className="w-full"
            >
              <line
                x1="0"
                y1={PLOT_TOP + PLOT_HEIGHT}
                x2={CHART_WIDTH}
                y2={PLOT_TOP + PLOT_HEIGHT}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
              {entries.map(([label, count], index) => {
                const height = (count / max) * PLOT_HEIGHT;
                const x = index * (barWidth + BAR_GUTTER);
                const y = PLOT_TOP + PLOT_HEIGHT - height;
                return (
                  <g key={label}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx={2}
                      className="fill-primary/85"
                    >
                      <title>{`${label}: ${count}`}</title>
                    </rect>
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize="10"
                      className="fill-muted-foreground tabular-nums"
                    >
                      {count}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y={CHART_HEIGHT - 4}
                      textAnchor="middle"
                      fontSize="10"
                      className="fill-muted-foreground"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </figure>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Sample data &middot; the employee endpoint is not built yet, so this chart sums the
          generated directory and resets each time the server restarts.
        </p>
      </CardContent>
    </Card>
  );
}
