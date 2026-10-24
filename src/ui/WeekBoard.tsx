// The week as a departure board: one row per pass, columns that line up.
// Before-dawn passes are listed separately so they never pose as "tonight".
// Docs: docs/DESIGN.md#week-board
import { useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { brightnessDots, compass16, fists } from '../engine/describe/describe.ts'
import { passPeriod, passScore } from '../engine/sky/schedule.ts'
import { WORTH_IT } from '../lib/state.ts'
import { stationName } from '../copy/en.ts'
import { dayOfMonth, formatTime, weekdayShort } from '../lib/format.ts'
import { passKey } from './TonightStrip.tsx'

type Props = {
  passes: readonly ForecastPass[]
  timeZone: string
  nowMs: number
  selectedKey: string | undefined
  onSelect: (p: ForecastPass) => void
}

export function WeekBoard({ passes, timeZone, nowMs, selectedKey, onSelect }: Props) {
  const [showDawn, setShowDawn] = useState(false)
  const upcoming = passes.filter((p) => p.end.unixMs > nowMs)
  const evening = upcoming.filter((p) => passPeriod(p, timeZone) !== 'before-dawn')
  const dawn = upcoming.filter((p) => passPeriod(p, timeZone) === 'before-dawn')

  return (
    <section aria-labelledby="week" className="mt-12">
      <h2 id="week" className="label">
        Next 7 evenings
      </h2>
      {evening.length === 0 ? (
        <p className="mt-3 text-ink-2">No evening passes in the next week.</p>
      ) : (
        <Rows passes={evening} timeZone={timeZone} selectedKey={selectedKey} onSelect={onSelect} />
      )}

      {dawn.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            aria-expanded={showDawn}
            onClick={() => setShowDawn((v) => !v)}
            className="text-sm text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          >
            {showDawn ? 'Hide' : 'Show'} {dawn.length} before-dawn pass
            {dawn.length === 1 ? '' : 'es'} for early risers
          </button>
          {showDawn && (
            <Rows
              passes={dawn}
              timeZone={timeZone}
              selectedKey={selectedKey}
              onSelect={onSelect}
              muted
            />
          )}
        </div>
      )}
    </section>
  )
}

function Rows({
  passes,
  timeZone,
  selectedKey,
  onSelect,
  muted,
}: Omit<Props, 'nowMs'> & { muted?: boolean }) {
  return (
    <ol className={`mt-3 border-t border-hair ${muted ? 'opacity-75' : ''}`}>
      {passes.map((p) => {
        const key = passKey(p)
        const selected = key === selectedKey
        const dots = brightnessDots(p.brightestMagnitude)
        // Low, faint passes stay listed (honesty) but recede visually.
        const weak = passScore(p) < WORTH_IT
        return (
          <li
            key={key}
            className={`border-b border-hair ${weak ? 'text-ink-3 [&_*]:text-ink-3' : ''}`}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(p)}
              className={`tnum grid w-full grid-cols-[2.75rem_5.25rem_1fr_auto] items-baseline gap-x-3 px-1 py-3 text-left transition-colors hover:bg-night-2 sm:grid-cols-[2.5rem_5.25rem_minmax(5.5rem,1fr)_6rem_3.25rem_5.5rem] sm:gap-x-2.5 ${selected ? 'bg-night-2' : ''}`}
            >
              <span className="text-ink-2">
                <span className="block text-xs">{weekdayShort(p.start.unixMs, timeZone)}</span>
                <span className="text-base text-ink">{dayOfMonth(p.start.unixMs, timeZone)}</span>
              </span>
              <span className="text-lg font-semibold">{formatTime(p.start.unixMs, timeZone)}</span>
              <span className="truncate">
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block size-2 rounded-full bg-station align-middle"
                />
                {stationName(p.noradId).short}
              </span>
              <span
                className="text-right text-ink-2 sm:text-left"
                title={`${Math.round(p.peak.elDeg)}° high`}
              >
                {Math.round(p.peak.elDeg)}°
                <span className="hidden sm:inline"> · {fists(p.peak.elDeg)} fists</span>
              </span>
              <span className="hidden sm:block" aria-label={`brightness ${dots} of 5`}>
                <Dots n={dots} />
              </span>
              <span className="hidden whitespace-nowrap text-ink-2 sm:block">
                {compass16(p.start.azDeg)} → {compass16(p.end.azDeg)}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-[3px] align-middle" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block size-[6px] rounded-full ${i < n ? 'bg-ink' : 'bg-hair-strong'}`}
        />
      ))}
    </span>
  )
}
