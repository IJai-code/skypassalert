// Local civil time in IANA time zones, using the platform's Intl database.
// Learn: docs/learn/01-time.md#time-zones
//
// We never store fixed offsets: "America/Los_Angeles" knows that 2026-11-01
// 01:30 happens twice and 2027-03-14 02:30 never happens. Getting this wrong
// is how a pass time ends up an hour off for a week, which is a trust killer.

export type LocalParts = {
  year: number
  month: number // 1–12
  day: number
  hour: number // 0–23
  minute: number
  second: number
  weekday: number // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    formatters.set(timeZone, f)
  }
  return f
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Wall-clock parts of an instant in a time zone. */
export function localParts(unixMs: number, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(unixMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  }
}

/** UTC offset of the zone at an instant, in minutes (e.g. −420 for PDT). */
export function offsetMinutes(unixMs: number, timeZone: string): number {
  const p = localParts(unixMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const wholeSecond = Math.floor(unixMs / 1000) * 1000
  return Math.round((asUtc - wholeSecond) / 60_000)
}

/**
 * The instant at which the wall clock in `timeZone` reads the given time.
 * Ambiguous times (DST fall-back) resolve to the earlier instant; skipped
 * times (spring-forward gap) are pushed forward by the length of the gap
 * (02:30 → 03:30), the same as Temporal's "compatible" disambiguation.
 */
export function zonedTimeToUnixMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second)
  // Two candidate offsets: the ones in force 12 h either side cover any DST edge.
  const before = offsetMinutes(naive - 12 * 3_600_000, timeZone)
  const after = offsetMinutes(naive + 12 * 3_600_000, timeZone)
  const candidates = [naive - before * 60_000, naive - after * 60_000].sort((a, b) => a - b)
  for (const t of candidates) {
    const p = localParts(t, timeZone)
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return t
    }
  }
  // Nonexistent local time: interpret it with the offset from before the gap,
  // which lands the same distance past the jump.
  return naive - Math.min(before, after) * 60_000
}

/** "YYYY-MM-DD" of the local calendar date. */
export function localDateKey(unixMs: number, timeZone: string): string {
  const p = localParts(unixMs, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Calendar arithmetic on "YYYY-MM-DD" keys (time-zone independent). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Split a "YYYY-MM-DD" key into numbers. */
export function parseDateKey(dateKey: string): [year: number, month: number, day: number] {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}
