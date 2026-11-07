// Every pass this week, set as an almanac table: an italic heading per day, one
// ruled line per pass with its path as a small sky-chart glyph. Evenings by
// default; before-dawn passes for early risers. Docs: docs/DESIGN.md#almanac
import { useState } from 'react'
import type { Forecast, ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { passPeriod, passScore } from '../../engine/sky/schedule.ts'
import { WORTH_IT } from '../../lib/state.ts'
import { passKey } from '../night/buildNight.ts'
import { PassChart, chartLabel } from '../night/PassChart.tsx'
import { dayLabel, formatDate, formatTime } from '../../lib/format.ts'
import { compass8 } from '../../engine/describe/describe.ts'
import { fistsLabel, minutesLabel, stationName } from '../../copy/en.ts'
import { isAfterBedtime } from '../../lib/settings.ts'
import { TwoWeeksLink } from '../CalendarButton.tsx'

type Filter = 'evening' | 'dawn' | 'all'

export function PassesScreen({
  forecast,
  place,
  nowMs,
  bedtime,
  onOpen,
}: {
  forecast: Forecast
  place: Place
  nowMs: number
  bedtime: string | null
  onOpen: (p: ForecastPass) => void
}) {
  const [filter, setFilter] = useState<Filter>('evening')
  const tz = place.timeZone
  // The forecast runs two weeks for the calendar; this tab is the next 8 days.
  const upcoming = forecast.passes.filter(
    (p) => p.end.unixMs > nowMs && p.start.unixMs < nowMs + 8 * 86_400_000,
  )
  const shown = upcoming.filter((p) =>
    filter === 'all'
      ? true
      : filter === 'dawn'
        ? passPeriod(p, tz) === 'before-dawn'
        : passPeriod(p, tz) !== 'before-dawn',
  )

  // One heading per day, in the place's own calendar.
  const days: Array<{ key: string; label: string; passes: ForecastPass[] }> = []
  for (const p of shown) {
    const key = formatDate(p.start.unixMs, tz)
    const last = days[days.length - 1]
    if (last?.key === key) last.passes.push(p)
    else {
      const rel = dayLabel(p.start.unixMs, nowMs, tz)
      days.push({
        key,
        label: rel === 'Today' || rel === 'Tomorrow' ? `${rel}, ${key.split(', ')[1]}` : key,
        passes: [p],
      })
    }
  }

  return (
    <main className="mx-auto max-w-[36rem] px-5 pt-[max(env(safe-area-inset-top),14px)] pb-28">
      <p className="mono flex justify-between border-b border-ink pb-1.5 text-[0.75rem] text-ink-2 uppercase">
        <span className="text-ink">{place.name}</span>
        <span>Next 8 days</span>
      </p>
      <h1 className="serif mt-6 text-[3.5rem] leading-none">Week</h1>

      <div role="tablist" aria-label="When" className="mono-caps mt-5 flex gap-6 text-[0.75rem]">
        {(
          [
            ['evening', 'Evenings'],
            ['dawn', 'Before dawn'],
            ['all', 'All'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`py-1 ${filter === id ? 'link text-ink' : 'text-ink-3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {days.map((d) => (
        <section key={d.key} aria-label={d.label} className="mt-7">
          <h2 className="serif-i border-b border-ink pb-1 text-[1.375rem]">{d.label}</h2>
          <ul>
            {d.passes.map((p) => (
              <li key={passKey(p)} className="border-b border-rule">
                <PassRow
                  pass={p}
                  place={place}
                  weak={passScore(p) < WORTH_IT}
                  late={
                    passPeriod(p, tz) !== 'before-dawn' &&
                    isAfterBedtime(p.start.unixMs, tz, bedtime)
                  }
                  onOpen={() => onOpen(p)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!shown.length && (
        <p className="mt-7 border-y border-rule py-4 text-ink-2">No passes in this window.</p>
      )}

      <div className="mt-6">
        <TwoWeeksLink
          passes={forecast.passes}
          placeName={place.name}
          timeZone={tz}
          bedtime={bedtime}
          nowMs={nowMs}
        />
      </div>
      <p className="mt-3 text-[0.8125rem] text-ink-3">
        Lines marked “low or faint” are listed for completeness, not worth a special trip.
      </p>
    </main>
  )
}

export function PassRow({
  pass,
  place,
  weak = false,
  late = false,
  onOpen,
}: {
  pass: ForecastPass
  place: Place
  weak?: boolean
  late?: boolean
  onOpen: () => void
}) {
  const tz = place.timeZone
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[2.75rem_4.25rem_1fr] items-center gap-3 py-2.5 text-left"
    >
      <PassChart
        pass={pass}
        size={44}
        labels={false}
        formatMinute={(ms) => formatTime(ms, tz)}
        label=""
      />
      <span className="mono text-[0.875rem]">
        {formatTime(pass.start.unixMs, tz).replace(' ', '\u00a0').toLowerCase()}
      </span>
      <span className="min-w-0">
        <span className="block text-station">
          {stationName(pass.noradId).short}
          {late ? (
            <span className="serif-i text-ink-3"> after bedtime</span>
          ) : (
            weak && <span className="serif-i text-ink-3"> low or faint</span>
          )}
        </span>
        <span className="mono block text-[0.6875rem] text-ink-3" aria-label={chartLabel(pass)}>
          {fistsLabel(pass.peak.elDeg)} up · {compass8(pass.start.azDeg)}→{compass8(pass.end.azDeg)}{' '}
          · {minutesLabel(pass.end.unixMs - pass.start.unixMs)}
        </span>
      </span>
    </button>
  )
}
