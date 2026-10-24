// Tonight at a glance: sunset → darkness → passes → bedtime on one line,
// shaded by how dark the sky is. Answers "does it fit before bed?" without reading.
// Docs: docs/DESIGN.md#tonight-strip
import type { Evening, ForecastPass } from '../engine/index.ts'
import { stationName } from '../copy/en.ts'
import { formatTime } from '../lib/format.ts'
import { addDays, parseDateKey, zonedTimeToUnixMs } from '../engine/time/zone.ts'

type Props = {
  evening: Evening
  passes: readonly ForecastPass[]
  timeZone: string
  bedtime: string // "HH:MM"
  selectedKey?: string | undefined
}

export function TonightStrip({ evening, passes, timeZone, bedtime, selectedKey }: Props) {
  if (evening.sunsetMs === null) return null
  const [bh, bm] = bedtime.split(':').map(Number) as [number, number]
  const date = parseDateKey(evening.dateKey)
  const bedMs = zonedTimeToUnixMs(timeZone, ...date, bh, bm)
  const from = evening.sunsetMs - 20 * 60_000
  const to = Math.max(bedMs + 60 * 60_000, zonedTimeToUnixMs(timeZone, ...date, 23))
  const span = to - from
  const pct = (t: number) =>
    `${(((Math.min(Math.max(t, from), to) - from) / span) * 100).toFixed(2)}%`

  const stops = [
    ['var(--sky-day)', evening.sunsetMs],
    ['var(--sky-civil)', evening.civilDuskMs],
    ['var(--sky-nautical)', evening.nauticalDuskMs],
    ['var(--sky-astro)', evening.astronomicalDuskMs],
  ] as const
  const gradient = stops
    .filter(([, t]) => t !== null)
    .map(([c, t]) => `${c} ${pct(t as number)}`)
    .join(', ')

  const hours: number[] = []
  for (let h = 6; h <= 23; h++) {
    const t = zonedTimeToUnixMs(timeZone, ...date, h)
    // Skip ticks that would collide with the bedtime label.
    if (t > from && t < to && Math.abs(t - bedMs) > 40 * 60_000) hours.push(t)
  }
  const tonight = passes.filter((p) => p.start.unixMs >= from && p.start.unixMs <= to)
  const nextMorning = zonedTimeToUnixMs(timeZone, ...parseDateKey(addDays(evening.dateKey, 1)), 0)

  return (
    <section aria-labelledby="tonight-strip" className="mt-2">
      <h2 id="tonight-strip" className="label">
        Tonight
      </h2>
      <div className="relative mt-9 h-9">
        <div
          className="absolute inset-0 rounded-[3px]"
          style={{ background: `linear-gradient(to right, ${gradient})` }}
          aria-hidden="true"
        />
        {tonight.map((p) => {
          const key = passKey(p)
          return (
            <div
              key={key}
              className="absolute top-0 h-full"
              style={{
                left: pct(p.start.unixMs),
                width: `max(4px, calc(${pct(p.end.unixMs)} - ${pct(p.start.unixMs)}))`,
              }}
            >
              <div
                className={`h-full rounded-[2px] bg-station ${selectedKey && selectedKey !== key ? 'opacity-50' : ''}`}
              />
              <span className="tnum absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-ink">
                {stationName(p.noradId).short} {formatTime(p.start.unixMs, timeZone)}
              </span>
            </div>
          )
        })}
        {bedMs < nextMorning && (
          <div
            className="absolute top-[-6px] bottom-[-6px] border-l border-dashed border-ink-2"
            style={{ left: pct(bedMs) }}
          >
            <span className="absolute top-full mt-1 -translate-x-1/2 text-xs whitespace-nowrap text-ink-2">
              bedtime
            </span>
          </div>
        )}
      </div>
      <div className="tnum relative mt-1 h-5 text-[11px] text-ink-3" aria-hidden="true">
        {hours.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
            {formatTime(t, timeZone).replace(':00', '').replace(' ', ' ')}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-2">
        Sunset{' '}
        <span className="tnum whitespace-nowrap text-ink">
          {formatTime(evening.sunsetMs, timeZone)}
        </span>
        {evening.civilDuskMs !== null && (
          <>
            {' · '}dark enough to spot it from{' '}
            <span className="tnum whitespace-nowrap text-ink">
              {formatTime(evening.civilDuskMs, timeZone)}
            </span>
          </>
        )}
        {tonight.length === 0 && ' · no station passes tonight'}
      </p>
    </section>
  )
}

export const passKey = (p: { noradId: number; start: { unixMs: number } }) =>
  `${p.noradId}-${p.start.unixMs}`
