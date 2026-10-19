/**
 * Deterministic sample presentation data for the profile panels that wait on
 * real modules (attendance, payroll, account) plus a few facts the directory
 * does not carry (phone, work location, supervisor).
 *
 * The directory generates its people from a seeded PRNG; these extras follow
 * the same pattern — derived from the employee id alone — so a profile shows
 * consistent sample data on every load and the "sample data" disclaimer stays
 * true. Attendance and payroll panels swap this for real rows once those
 * modules go live, so nothing here duplicates business rules: it is surface
 * data only.
 */

/** Same PRNG the employee directory uses, so both sources sample alike. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(id: string): number {
  const FIRST = 'profile-extras';
  let hash = 2166136261;
  for (const name of [id, FIRST]) {
    for (let index = 0; index < name.length; index += 1) {
      hash ^= name.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

function between(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const value = items[Math.floor(rng() * items.length)];
  return value !== undefined ? value : (items[0] as T);
}

// `en-GB` pinned to UTC on purpose: locale- or zone-dependent dates would
// differ between the server and any later client render.
const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH_CELL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const WORK_LOCATIONS = [
  'Head Office, Jakarta',
  'Cibis Office, Jakarta',
  'Bandung Office, Bandung',
  'Surabaya Office, Surabaya',
] as const;

const WORK_PATTERNS = ['Hybrid (3 office days)', 'Hybrid (2 office days)', 'On-site'] as const;

const BANKS = ['Bank Central Asia (BCA)', 'Bank Mandiri', 'Bank Rakyat Indonesia (BRI)'] as const;

const SUPERVISOR_FIRST = ['Dewi', 'Andi', 'Sari', 'Budi', 'Rina', 'Tono'] as const;
const SUPERVISOR_LAST = ['Anggraini', 'Wijaya', 'Santoso', 'Lestari', 'Pratama'] as const;

const ACTIVITY_TEMPLATES = [
  'Quarterly performance review completed',
  'Annual leave request approved',
  'Payslip issued',
  'Certification added',
  'Contract granted',
] as const;

export interface AttendanceCell {
  readonly day: number;
  readonly status: 'present' | 'late' | 'leave' | 'absent' | 'off' | 'upcoming';
}

export interface AttendanceEntry {
  readonly label: string;
  readonly inTime: string;
  readonly outTime: string;
  readonly status: 'Present' | 'Late' | 'Leave';
  readonly variant: 'success' | 'warning' | 'info';
}

export interface AttendanceSample {
  readonly headers: readonly string[];
  readonly monthLabel: string;
  /** 0–6 leading blanks (Monday-first) before day 1 of the month. */
  readonly leadingBlanks: number;
  readonly days: readonly AttendanceCell[];
  readonly todayDay: number;
  readonly counts: {
    readonly present: number;
    readonly late: number;
    readonly leave: number;
    readonly absent: number;
  };
  readonly entries: readonly AttendanceEntry[];
  /** Whole-month attendance share, the Overview stat. */
  readonly attendancePct: number;
}

export interface PayrollSample {
  readonly periodLabel: string;
  readonly components: readonly { name: string; kind: 'Earning'; amount: number }[];
  readonly deductions: readonly { name: string; kind: 'Deduction'; amount: number }[];
  /** Positive take-home number; the panel renders the sign. */
  readonly netPay: number;
  readonly slips: readonly { period: string; net: number }[];
  readonly bank: { readonly bank: string; readonly account: string; readonly holder: string };
}

export interface AccountSample {
  readonly username: string;
  readonly email: string;
  readonly roles: string;
  readonly accountStatus: 'Active';
  readonly lastLogin: string;
  readonly passwordChanged: string;
}

export interface ActivityItem {
  readonly title: string;
  readonly date: string;
}

export interface ProfileExtras {
  readonly phone: string;
  readonly workLocation: string;
  readonly supervisor: string;
  readonly grade: string;
  readonly workPattern: string;
  readonly confirmedOn: string;
  readonly tenureLabel: string;
  readonly leaveRemaining: number;
  readonly performanceLabel: string;
  readonly activity: readonly ActivityItem[];
  readonly attendance: AttendanceSample;
  readonly payroll: PayrollSample;
  /** `null` = the employee has no user account yet; the Account tab offers create. */
  readonly account: AccountSample | null;
}

function iso(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addMonths(base: Date, months: number): Date {
  return new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);
}

/**
 * Everything the decorative profile panels need, keyed to `employeeId`.
 *
 * `today` comes from the caller (the force-dynamic profile page), which keeps
 * this module pure and testable while the calendar and activity dates stay
 * anchored to the real "now".
 */
export function profileExtrasFor(
  employeeId: string,
  employee: { readonly hireDate: string; readonly email: string; readonly fullName: string },
  today: Date,
): ProfileExtras {
  const rng = mulberry32(seedFor(employeeId));

  const phone = `+62 81${between(rng, 1, 9)}-${between(rng, 1000, 9999)}-${between(rng, 1000, 9999)}`;
  const workLocation = pick(rng, WORK_LOCATIONS);
  const supervisor = `${pick(rng, SUPERVISOR_FIRST)} ${pick(rng, SUPERVISOR_LAST)}`;
  const grade = `Grade ${between(rng, 5, 9)}`;
  const workPattern = pick(rng, WORK_PATTERNS);

  const hire = new Date(employee.hireDate);
  const monthsTotal = Math.max(
    0,
    (today.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
      (today.getUTCMonth() - hire.getUTCMonth()),
  );
  const tenureLabel = `${Math.floor(monthsTotal / 12)} yr ${monthsTotal % 12} mo`;
  const confirmedOn = MONTH_YEAR_FORMAT.format(addMonths(hire, 6));

  const leaveRemaining = between(rng, 2, 12);
  const performanceLabel = `Q${Math.floor(today.getUTCMonth() / 3)} · ${(between(rng, 35, 50) / 10).toFixed(1)}/5`;

  /** Recent activity: four deterministic events anchored backwards from today. */
  const activity: ActivityItem[] = Array.from({ length: 4 }, (_, index) => ({
    title: pick(rng, ACTIVITY_TEMPLATES),
    date: DAY_FORMAT.format(
      new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          Math.max(1, today.getUTCDate() - index * 9),
        ),
      ),
    ),
  }));

  // Attendance month: Monday-first calendar of `today`'s month.
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const todayDay = today.getUTCDate();

  const days: AttendanceCell[] = [];
  const counts = { present: 0, late: 0, leave: 0, absent: 0 };
  const entries: AttendanceEntry[] = [];
  let lateSeen = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = (leadingBlanks + day - 1) % 7;
    if (dow >= 5) {
      days.push({ day, status: 'off' });
      continue;
    }
    if (day > todayDay) {
      days.push({ day, status: 'upcoming' });
      continue;
    }
    const roll = rng();
    if (roll < 0.08) {
      counts.late += 1;
      lateSeen += 1;
      days.push({ day, status: 'late' });
      entries.push({
        label: DAY_FORMAT.format(iso(year, month, day)),
        inTime: `09.${18 + ((lateSeen * 7) % 40)}`,
        outTime: `17.${between(rng, 10, 50)}`,
        status: 'Late',
        variant: 'warning',
      });
      continue;
    }
    if (roll < 0.18) {
      counts.leave += 1;
      days.push({ day, status: 'leave' });
      entries.push({
        label: DAY_FORMAT.format(iso(year, month, day)),
        inTime: '—',
        outTime: '—',
        status: 'Leave',
        variant: 'info',
      });
      continue;
    }
    if (roll < 0.2 && counts.absent < 1) {
      counts.absent += 1;
      days.push({ day, status: 'absent' });
      continue;
    }
    counts.present += 1;
    days.push({ day, status: 'present' });
    entries.push({
      label: DAY_FORMAT.format(iso(year, month, day)),
      inTime: `07.${48 + ((day * 3) % 10)}`,
      outTime: `17.${between(rng, 10, 50)}`,
      status: 'Present',
      variant: 'success',
    });
  }

  const worked = counts.present + counts.late + counts.absent;
  const attendancePct =
    worked === 0 ? 0 : Math.round(((counts.present + counts.late) / worked) * 100);

  // Payroll: a mid-level Jakarta-band base with standard labelling. Surface
  // data only — the payroll module will compute the real thing.
  const base = between(rng, 140, 220) * 50_000;
  const positional = Math.round((base * 0.22) / 50_000) * 50_000;
  const transport = Math.round((base * 0.08) / 50_000) * 50_000;
  const meal = Math.round((base * 0.06) / 50_000) * 50_000;
  const bpjsHealth = -Math.round(base * 0.01);
  const bpjsJht = -Math.round(base * 0.02);
  const pph = -Math.round((base + positional) * 0.06);
  const netPay = base + positional + transport + meal + bpjsHealth + bpjsJht + pph;

  const slipPeriods: string[] = [];
  for (let back = 1; back <= 6; back += 1) {
    const when = new Date(Date.UTC(year, month - back, 1));
    slipPeriods.push(MONTH_YEAR_FORMAT.format(when));
  }
  const slips = slipPeriods.map((period, index) => ({
    period,
    net: index < 2 ? netPay : netPay - between(rng, 1, 3) * 450_000,
  }));

  const accountNumber = between(rng, 1000, 9999);

  return {
    phone,
    workLocation,
    supervisor,
    grade,
    workPattern,
    confirmedOn,
    tenureLabel,
    leaveRemaining,
    performanceLabel,
    activity,
    attendance: {
      headers: MONTH_CELL_HEADERS,
      monthLabel: MONTH_YEAR_FORMAT.format(today),
      leadingBlanks,
      days,
      todayDay,
      counts,
      entries: entries.slice(-6).reverse(),
      attendancePct,
    },
    payroll: {
      periodLabel: MONTH_YEAR_FORMAT.format(today),
      components: [
        { name: 'Base salary', kind: 'Earning', amount: base },
        { name: 'Position allowance', kind: 'Earning', amount: positional },
        { name: 'Transport allowance', kind: 'Earning', amount: transport },
        { name: 'Meal allowance', kind: 'Earning', amount: meal },
      ],
      deductions: [
        { name: 'BPJS Kesehatan (1%)', kind: 'Deduction', amount: bpjsHealth },
        { name: 'BPJS JHT (2%)', kind: 'Deduction', amount: bpjsJht },
        { name: 'Income tax (PPh 21)', kind: 'Deduction', amount: pph },
      ],
      netPay,
      slips,
      bank: {
        bank: pick(rng, BANKS),
        account: `••••${accountNumber}`,
        holder: employee.fullName,
      },
    },
    account:
      rng() < 0.8
        ? {
            username: employee.email.split('@')[0] ?? employee.email,
            email: employee.email,
            roles: rng() < 0.5 ? 'Employee, Leave Approver' : 'Employee',
            accountStatus: 'Active',
            lastLogin: `${DAY_FORMAT.format(today)}, ${String(between(rng, 7, 9))}.${between(rng, 10, 59)} local`,
            passwordChanged: MONTH_YEAR_FORMAT.format(
              new Date(today.getTime() - between(rng, 1, 6) * 30 * 24 * 60 * 60 * 1000),
            ),
          }
        : null,
  };
}
