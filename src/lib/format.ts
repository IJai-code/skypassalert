// Date and time formatting in the place's own time zone (never the device's:
// someone in Shanghai checking Fremont for a grandparent needs Fremont time).
const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(timeZone: string, key: string, options: Intl.DateTimeFormatOptions) {
  const k = `${timeZone}|${key}`
  let f = cache.get(k)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, ...options })
    cache.set(k, f)
  }
  return f
}

/** "7:32" and "PM", split so the UI can set them at different sizes. */
export function timeParts(ms: number, timeZone: string): { clock: string; period: string } {
  const parts = fmt(timeZone, 't', { hour: 'numeric', minute: '2-digit' }).formatToParts(
    new Date(ms),
  )
  const clock = parts
    .filter(
      (p) => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value === ':'),
    )
    .map((p) => p.value)
    .join('')
  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? ''
  return { clock, period }
}

export function formatTime(ms: number, timeZone: string): string {
  const { clock, period } = timeParts(ms, timeZone)
  return period ? `${clock} ${period}` : clock
}

export function formatTimeSeconds(ms: number, timeZone: string): string {
  return fmt(timeZone, 'ts', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(
    new Date(ms),
  )
}

/** "Sat, Oct 24" */
export function formatDate(ms: number, timeZone: string): string {
  return fmt(timeZone, 'd', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(ms),
  )
}

/** "Today", "Tomorrow", or "Tuesday", relative to `nowMs` in the place's zone. */
export function dayLabel(ms: number, nowMs: number, timeZone: string): string {
  const f = fmt(timeZone, 'ymd', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const key = (t: number) => f.format(new Date(t))
  if (key(ms) === key(nowMs)) return 'Today'
  if (key(ms) === key(nowMs + 86_400_000)) return 'Tomorrow'
  return fmt(timeZone, 'wd', { weekday: 'long' }).format(new Date(ms))
}

export function weekdayShort(ms: number, timeZone: string): string {
  return fmt(timeZone, 'wds', { weekday: 'short' }).format(new Date(ms))
}

export function dayOfMonth(ms: number, timeZone: string): string {
  return fmt(timeZone, 'dom', { day: 'numeric' }).format(new Date(ms))
}

/** "in 2 h 14 min", "in 6 min", "in 40 s" */
export function countdown(deltaMs: number): string {
  const s = Math.max(0, Math.round(deltaMs / 1000))
  if (s < 60) return `in ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `in ${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `in ${h} h ${rest} min` : `in ${h} h`
}

/** "2 hours ago", "35 minutes ago" for data age. */
export function ago(deltaMs: number): string {
  const m = Math.round(deltaMs / 60_000)
  if (m < 60) return `${Math.max(1, m)} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}
