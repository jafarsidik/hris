const FIELD_RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

function parseField(field: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const slash = part.indexOf('/');
    const step = slash === -1 ? 1 : Number(part.slice(slash + 1));
    const base = slash === -1 ? part : part.slice(0, slash);
    if (!Number.isFinite(step) || step < 1) {
      return null;
    }
    let lo: number;
    let hi: number;
    if (base === '*' || base === '') {
      lo = min;
      hi = max;
    } else if (base.includes('-')) {
      const parts = base.split('-').map(Number);
      if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v))) {
        return null;
      }
      lo = Math.max(min, parts[0] ?? min);
      hi = Math.min(max, parts[1] ?? max);
    } else {
      const value = Number(base);
      if (!Number.isFinite(value)) {
        return null;
      }
      lo = value;
      hi = value;
    }
    if (lo < min || hi > max || lo > hi) {
      return null;
    }
    for (let v = lo; v <= hi; v += step) {
      out.add(v);
    }
  }
  return out;
}

export function nextCronDate(cron: string, after: Date): Date | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  const sets: Set<number>[] = [];
  for (let i = 0; i < 5; i++) {
    const range = FIELD_RANGES[i];
    const field = fields[i];
    if (!range || field === undefined) {
      return null;
    }
    const parsed = parseField(field, range[0], range[1]);
    if (parsed === null) {
      return null;
    }
    sets.push(parsed);
  }

  const minuteSet = sets[0] as Set<number>;
  const hourSet = sets[1] as Set<number>;
  const domSet = sets[2] as Set<number>;
  const monSet = sets[3] as Set<number>;
  const dowSet = sets[4] as Set<number>;

  const d = new Date(after.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (
      minuteSet.has(d.getMinutes()) &&
      hourSet.has(d.getHours()) &&
      domSet.has(d.getDate()) &&
      monSet.has(d.getMonth() + 1) &&
      dowSet.has(d.getDay())
    ) {
      return d;
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}
