// The one screen. Mobile: a single column that leads with the answer.
// Wide screens: answer + sky map on the left, the rest of the night on the right.
// Docs: docs/DESIGN.md
import { useEffect, useMemo, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { DEFAULT_PLACE } from '../presets.ts'
import { useForecast, useNow } from '../lib/hooks.ts'
import { homeState } from '../lib/state.ts'
import { formatDate } from '../lib/format.ts'
import { Answer } from '../ui/Answer.tsx'
import { SkyDome } from '../ui/SkyDome.tsx'
import { TonightStrip, passKey } from '../ui/TonightStrip.tsx'
import { WeekBoard } from '../ui/WeekBoard.tsx'
import { AlsoTonight } from '../ui/AlsoTonight.tsx'
import { DataAge } from '../ui/DataAge.tsx'
import { TakeItOutside } from '../ui/TakeItOutside.tsx'
import { Footer, Header } from '../ui/Chrome.tsx'

const BEDTIME = '21:30' // family-mode default; configurable in v0.1
const NO_PASSES: never[] = []

export function Home() {
  const place = DEFAULT_PLACE
  const fc = useForecast(place)
  const [focus, setFocus] = useState<ForecastPass | null>(null)
  const [nightMode, setNightMode] = useNightMode()

  const ready = fc.status === 'ready' ? fc.forecast : null
  const now = useNow(ready?.passes ?? NO_PASSES)

  const state = useMemo(() => (ready ? homeState(ready, now) : null), [ready, now])
  const shown: ForecastPass | null =
    focus ?? (state && 'pass' in state ? state.pass : (state?.next ?? null))
  const tonight = ready?.nights[0]
  // The evening the shown pass belongs to (for its sunset direction).
  const night =
    ready?.nights.find(
      (n) =>
        shown &&
        n.evening.sunsetMs !== null &&
        Math.abs(shown.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
    ) ?? tonight

  return (
    <div className="mx-auto min-h-dvh max-w-[34rem] px-5 wide:max-w-6xl wide:px-10">
      <Header placeName={place.name} dateLabel={formatDate(now, place.timeZone)} />

      {fc.status === 'loading' && <Loading />}
      {fc.status === 'error' && <LoadError message={fc.message} />}

      {ready && state && night && tonight && (
        <main className="mt-6 wide:mt-10 wide:grid wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] wide:gap-16">
          <div>
            <Answer
              state={state}
              focus={focus}
              onClearFocus={() => setFocus(null)}
              nights={ready.nights}
              placeName={place.name}
              timeZone={place.timeZone}
              nowMs={now}
              nightMode={nightMode}
              onNightMode={setNightMode}
            />
            {shown && (
              <SkyDome
                pass={shown}
                timeZone={place.timeZone}
                sunsetAzDeg={night.evening.sunsetAzDeg}
                moon={shown.moonAtPeak}
                nowMs={now}
                className="mx-auto mt-10 max-w-[22rem] wide:mx-0"
              />
            )}
            {shown && (
              <div className="mt-6">
                <DataAge
                  epochMs={ready.elements.find((e) => e.noradId === shown.noradId)?.epochMs ?? now}
                  nowMs={now}
                />
              </div>
            )}
          </div>

          <div className="mt-14 wide:mt-1">
            <TonightStrip
              evening={tonight.evening}
              passes={ready.passes}
              timeZone={place.timeZone}
              bedtime={BEDTIME}
              selectedKey={shown ? passKey(shown) : undefined}
            />
            <WeekBoard
              passes={ready.passes}
              timeZone={place.timeZone}
              nowMs={now}
              selectedKey={focus ? passKey(focus) : undefined}
              onSelect={(p) => {
                setFocus(p)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
            <AlsoTonight night={tonight} timeZone={place.timeZone} />
            <div className="mt-12">
              <TakeItOutside />
            </div>
          </div>
        </main>
      )}

      <Footer />
    </div>
  )
}

function useNightMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return sessionStorage.getItem('spa:night') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.dataset.mode = on ? 'night' : ''
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', on ? '#000000' : '#080c1a')
    try {
      sessionStorage.setItem('spa:night', on ? '1' : '0')
    } catch {
      // ignore
    }
  }, [on])
  return [on, setOn]
}

function Loading() {
  return (
    <main className="mt-6" aria-busy="true">
      <p className="text-base text-ink-2">Tonight</p>
      <p className="mt-2 text-xl text-ink-3">Working out where the stations will be…</p>
    </main>
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="mt-6">
      <h1 className="text-2xl font-semibold">We couldn’t load the orbit data.</h1>
      <p className="mt-2 text-ink-2">
        Check your connection and reload. If it keeps happening, tell us at hello@skypassalert.com.
      </p>
      <p className="mt-2 text-sm text-ink-3">({message})</p>
    </main>
  )
}
