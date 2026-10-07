'use client';

import { useEffect, useState } from 'react';

/**
 * The command-center greeting and today's date.
 *
 * Both are time-of-day state, so they are computed after mount only: the server renders a
 * stable placeholder of the same height, and the client fills in the real value. A value
 * computed during server render would be pinned to the container's clock and timezone,
 * which disagrees with the reader's browser — the exact hydration failure the rest of the
 * app avoids by pinning to UTC. A time-of-day greeting cannot be pinned, so it waits.
 */

const phraseFor = (hour: number): string => {
  if (hour < 12) return 'Good morning, HR Team';
  if (hour < 17) return 'Good afternoon, HR Team';
  return 'Good evening, HR Team';
};

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function DashboardGreeting() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  return (
    <div className="grid gap-0.5">
      <p className="h-7 truncate text-lg font-semibold tracking-tight">
        {now === null ? ' ' : phraseFor(now.getHours())}
      </p>
      <p className="h-5 truncate text-sm text-muted-foreground">
        {now === null ? ' ' : dateFormat.format(now)}
      </p>
    </div>
  );
}
