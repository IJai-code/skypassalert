// Every pass this week, as cards: evenings first, before-dawn for early
// risers, each with a one-tap reminder.
import { useState } from 'react'
import type { Forecast, ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { passPeriod, passScore } from '../../engine/sky/schedule.ts'
import { WORTH_IT } from '../../lib/state.ts'
import { passKey } from '../night/buildNight.ts'
import { SkyThumb } from './SkyThumb.tsx'
import { dayLabel, dayOfMonth, formatTime, weekdayShort } from '../../lib/format.ts'
import { buildIcs } from '../../lib/ics.ts'
import { compass8 } from '../../engine/describe/describe.ts'
import { minutesLabel, pathSentence, stationName } from '../../copy/en.ts'
import { detectInAppBrowser } from '../../lib/env.ts'
import { IconBell } from './Icons.tsx'

type Filter = 'evening' | 'dawn' | 'all'

export function PassesScreen({
  forecast,
  place,
  catalog,
  nowMs,
  onOpen,
}: {
  forecast: Forecast
  place: Place
  catalog: StarCatalog | null
  nowMs: number
  onOpen: (p: ForecastPass) => void
}) {
  const [filter, setFilter] = useState<Filter>('evening')
  const tz = place.timeZone
  const upcoming = forecast.passes.filter((p) => p.end.unixMs > nowMs)
  const shown = upcoming.filter((p) =>
    filter === 'all'
      ? true
      : filter === 'dawn'
        ? passPeriod(p, tz) === 'before-dawn'
        : passPeriod(p, tz) !== 'before-dawn',
  )

  // All the worthwhile evening passes in one calendar file.
  const addAll = () => {
    const good = upcoming.filter(
      (p) => passPeriod(p, tz) !== 'before-dawn' && passScore(p) >= WORTH_IT,
    )
    if (!good.length || detectInAppBrowser()) return
    const events = good.map((p) =>
      buildIcs({
        uid: `${p.noradId}-${Math.round(p.start.unixMs / 1000)}@skypassalert.com`,
        startMs: p.start.unixMs,
        endMs: p.end.unixMs,
        title: `${stationName(p.noradId).short} over ${place.name}: look ${compass8(p.start.azDeg)}`,
        description: `${pathSentence(p)} https://skypassalert.com/?s=ics`,
        location: place.name,
        url: 'https://skypassalert.com/?s=ics',
        alarmMinutesBefore: 10,
      }),
    )
    // Merge the VEVENT blocks into one calendar.
    const body = events
      .map((e) => e.slice(e.indexOf('BEGIN:VEVENT'), e.indexOf('END:VCALENDAR')))
      .join('')
    const first = events[0] ?? ''
    const ics = first.slice(0, first.indexOf('BEGIN:VEVENT')) + body + 'END:VCALENDAR\r\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    a.download = 'skypassalert-this-week.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),16px)] pb-32 wide:max-w-3xl">
      <h1 className="display text-[2.5rem] leading-none tracking-[-0.03em]">Week</h1>
      <p className="mt-1 text-sm text-ink-2">Next 8 days over {place.name}</p>

      <div
        role="tablist"
        aria-label="When"
        className="mt-5 flex gap-1 rounded-full bg-white/[0.05] p-1 ring-1 ring-hair"
      >
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
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${filter === id ? 'bg-white/15 text-ink' : 'text-ink-2'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={addAll}
        className="display mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-action py-3 text-action-ink"
      >
        <IconBell className="size-5" /> Add this week’s best to my calendar
      </button>

      <ul className="mt-5 border-t border-hair">
        {shown.map((p) => {
          const weak = passScore(p) < WORTH_IT
          return (
            <li key={passKey(p)} className={`border-b border-hair ${weak ? 'opacity-55' : ''}`}>
              <PassRow
                pass={p}
                place={place}
                catalog={catalog}
                nowMs={nowMs}
                onOpen={() => onOpen(p)}
              />
            </li>
          )
        })}
        {!shown.length && <li className="py-5 text-ink-2">No passes in this window.</li>}
      </ul>
      <p className="mt-4 text-xs text-ink-3">
        Faded rows are low or faint: listed for completeness, not worth a special trip.
      </p>
    </div>
  )
}
export function PassRow({
  pass,
  place,
  catalog,
  nowMs,
  onOpen,
  trailing,
}: {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  nowMs: number
  onOpen: () => void
  trailing?: React.ReactNode
}) {
  const tz = place.timeZone
  return (
    <div className="flex items-center gap-4 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
          {pass.noradId === 25544 ? (
            <img src="/img/iss.webp" alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <SkyThumb
              pass={pass}
              place={place}
              catalog={catalog}
              labels={false}
              horizonAt={0.8}
              className="block h-full w-full"
              label=""
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.75rem] text-ink-3">
            {dayLabel(pass.start.unixMs, nowMs, tz)} · {weekdayShort(pass.start.unixMs, tz)}{' '}
            {dayOfMonth(pass.start.unixMs, tz)}
          </p>
          <p className="display tnum text-[1.5rem] leading-tight tracking-[-0.02em]">
            {formatTime(pass.start.unixMs, tz)}{' '}
            <span className="text-[0.875rem] font-semibold text-ink-2">
              {stationName(pass.noradId).short}
            </span>
          </p>
          <p className="text-[0.75rem] text-ink-2">
            {Math.round(pass.peak.elDeg)}° high · {compass8(pass.start.azDeg)}→
            {compass8(pass.end.azDeg)} · {minutesLabel(pass.end.unixMs - pass.start.unixMs)}
          </p>
        </div>
      </button>
      {trailing}
    </div>
  )
}
