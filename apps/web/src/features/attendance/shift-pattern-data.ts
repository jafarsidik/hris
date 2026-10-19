import type { ShiftPattern } from './attendance-types';

/**
 * Deterministic shift pattern data for the configuration screen until the
 * live API is the default data source. The shape mirrors the API contract
 * (`ShiftPatternSummary` in `@hris/shared-types`).
 */
export const SHIFT_PATTERNS: readonly ShiftPattern[] = Object.freeze([
  {
    id: 'shift-0001',
    code: 'STD',
    name: 'Standard Office Hours',
    description: 'Regular office day shift.',
    startTime: '2026-01-01T08:00:00Z',
    endTime: '2026-01-01T17:00:00Z',
    breakMinutes: 60,
    workDays: '1,2,3,4,5',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'shift-0002',
    code: 'EARLY',
    name: 'Early Shift',
    description: 'Starts before standard hours for coverage.',
    startTime: '2026-01-01T06:00:00Z',
    endTime: '2026-01-01T14:00:00Z',
    breakMinutes: 30,
    workDays: '1,2,3,4,5,6',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'shift-0003',
    code: 'NIGHT',
    name: 'Night Shift',
    description: 'Overnight operations shift.',
    startTime: '2026-01-01T22:00:00Z',
    endTime: '2026-01-02T06:00:00Z',
    breakMinutes: 45,
    workDays: '1,2,3,4,5,6,7',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
] as const);

const DAY_NAMES: Record<string, string> = {
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
  '7': 'Sun',
};

/** "1,2,3,4,5" → "Mon–Fri"; used by the shift pattern screen. */
export function workDaysLabel(workDays: string): string {
  const days = workDays
    .split(',')
    .map((day) => DAY_NAMES[day.trim()] ?? day.trim())
    .filter(Boolean);
  if (days.length <= 1) return days.join('');
  return `${days[0]}–${days[days.length - 1]}`;
}

/** "08:00:00Z" tail trimmed from the stored timestamp's 08:00 segment. */
export function timeLabel(iso: string): string {
  const time = iso.slice(11, 16);
  return time === '' ? iso : time;
}
