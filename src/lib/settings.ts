// Family settings: a bedtime and a "simple words" register. Kept on this
// device only, like the saved place. A pass after bedtime is still listed,
// but it never takes the headline.
// Docs: docs/DESIGN.md#family, docs/DECISIONS.md (D-032)

export type Family = {
  /** "HH:MM" on a 24-hour clock, or null for "any time". */
  bedtime: string | null
  simpleWords: boolean
}

export const DEFAULT_FAMILY: Family = { bedtime: '21:30', simpleWords: false }
const KEY = 'spa:family'
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function loadFamily(): Family {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const f = JSON.parse(raw) as Partial<Family>
      return {
        bedtime: f.bedtime === null || (f.bedtime && HHMM.test(f.bedtime)) ? f.bedtime : '21:30',
        simpleWords: f.simpleWords === true,
      }
    }
  } catch {
    // private mode or bad data: defaults
  }
  return DEFAULT_FAMILY
}

export function saveFamily(f: Family): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f))
  } catch {
    // ignore
  }
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const localMinutes = (() => {
  const cache = new Map<string, Intl.DateTimeFormat>()
  return (ms: number, tz: string) => {
    let f = cache.get(tz)
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
      cache.set(tz, f)
    }
    const parts = f.formatToParts(new Date(ms))
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
    return h * 60 + m
  }
})()

/**
 * Is this evening moment after bedtime? Clocks are compared on an "evening
 * dial" that runs noon → noon, so a 00:30 bedtime counts as later than 23:00.
 * Before-dawn passes are for early risers and are never "after bedtime".
 */
export function isAfterBedtime(ms: number, tz: string, bedtime: string | null): boolean {
  if (!bedtime) return false
  const dial = (m: number) => (m < 12 * 60 ? m + 24 * 60 : m)
  const t = localMinutes(ms, tz)
  if (t >= 4 * 60 && t < 12 * 60) return false
  return dial(t) >= dial(minutesOf(bedtime))
}

/** "9:30 pm" for the running head. */
export function bedtimeLabel(bedtime: string | null): string {
  if (!bedtime) return 'any time'
  const m = minutesOf(bedtime)
  const h = Math.floor(m / 60)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
