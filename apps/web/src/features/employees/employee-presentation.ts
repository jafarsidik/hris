import type { VariantProps } from 'class-variance-authority';

import type { badgeVariants } from '@/components/ui/badge';

/**
 * How an employment status is presented.
 *
 * Presentation only, and therefore separate from {@link Employee.status}, which stays a
 * plain code so the data layer never depends on a design system. Keeping the two apart
 * means a status can be relabelled or recoloured without touching what the repository
 * returns, and a new status can arrive from the API without a build error here — it
 * falls through to `outline` and says its raw code.
 */

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

interface StatusPresentation {
  readonly label: string;
  readonly variant: BadgeVariant;
}

const PRESENTATION: Readonly<Record<string, StatusPresentation>> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  ON_LEAVE: { label: 'On leave', variant: 'warning' },
  PROBATION: { label: 'Probation', variant: 'secondary' },
  INACTIVE: { label: 'Inactive', variant: 'outline' },
};

const FALLBACK: StatusPresentation = { label: 'Unknown', variant: 'outline' };

export function describeStatus(status: string): StatusPresentation {
  const known = PRESENTATION[status];

  if (known !== undefined) {
    return known;
  }

  // Showing the raw code beats showing "Unknown": a status the UI has not been taught
  // about is a fact about the data, and hiding it makes the row look empty.
  return { label: status, variant: FALLBACK.variant };
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  // Pinned deliberately. Without it the server formats in the container's zone and the
  // client in the reader's, so any date near midnight differs between the two and React
  // reports a hydration mismatch. Pinning to UTC makes both sides agree; converting to
  // the reader's local date is a later, explicit decision.
  timeZone: 'UTC',
});

/** A date-only value, as the employee record stores it. */
/**
 * Up to two initials for the avatar.
 *
 * Purely cosmetic, so it must never throw and never return something surprising: a name
 * with no letters, or one that is all punctuation, yields an empty string and the caller
 * renders nothing rather than a stray glyph.
 *
 * Single-word names contribute one letter, not two — "Prince" is "P", not "PR", which
 * would read as a different word.
 */
export function initialsFor(fullName: string): string {
  const words = fullName
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0);

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats an ISO date for display.
 *
 * The shape is validated before parsing, and the result is checked against the input,
 * because `new Date()` is permissive in two ways that both corrupt data silently:
 *
 * - `2020-02-31` rolls over to 2 March, so an impossible hire date would render as a
 *   different and entirely plausible date.
 * - `2020` parses as 1 January, inventing a day the record never claimed.
 *
 * Neither is a formatting bug; both are a false statement about a person's employment.
 * When the value is not a real `YYYY-MM-DD` date it is returned unchanged, so the bad
 * value stays visible and can be traced to the record.
 */
export function formatHireDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (match === null) {
    return isoDate;
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${isoDate}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    return isoDate;
  }

  // Unreachable given the checks above, but TypeScript needs the parts to be strings and
  // a future change to the pattern must not be able to produce `NaN` output silently.
  if (year === undefined || month === undefined || day === undefined) {
    return isoDate;
  }

  return dateFormat.format(parsed);
}
