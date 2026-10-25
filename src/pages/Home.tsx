// The app: the whole screen is your sky (SkyStage), and everything else lives
// in a sheet over it, the way a camera or maps app works rather than a page
// of sections. The sheet's first glance is tonight's answer.
// Docs: docs/DESIGN.md
import { useEffect, useMemo, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { nearestLandmark, skyScene } from '../engine/sky/scene.ts'
import { DEFAULT_PLACE } from '../presets.ts'
import { useForecast, useNow } from '../lib/hooks.ts'
import { homeState } from '../lib/state.ts'
import { answerModel, Details, Peek } from '../ui/Answer.tsx'
import { CompassCard } from '../ui/CompassCard.tsx'
import { TonightStrip, passKey } from '../ui/TonightStrip.tsx'
import { WeekBoard } from '../ui/WeekBoard.tsx'
import { AlsoTonight } from '../ui/AlsoTonight.tsx'
import { DataAge } from '../ui/DataAge.tsx'
import { Footer } from '../ui/Chrome.tsx'
import { SkyStage, type StageMode } from '../ui/SkyStage.tsx'
import { Sheet, type SheetState } from '../ui/Sheet.tsx'
import { useStarCatalog } from '../sky/useStarCatalog.ts'
import { requestMotionPermission } from '../sky/useOrientation.ts'

const BEDTIME = '21:30' // family-mode default; configurable in v0.1
const NO_PASSES: never[] = []
const PEEK_PX = 296

export function Home() {
  const place = DEFAULT_PLACE
  const fc = useForecast(place)
  const catalog = useStarCatalog()
  const [focus, setFocus] = useState<ForecastPass | null>(null)
  const [nightMode, setNightMode] = useNightMode()
  const [mode, setMode] = useState<StageMode>('sky')
  const [sheet, setSheet] = useState<SheetState>('peek')
  const wide = useWide()

  const ready = fc.status === 'ready' ? fc.forecast : null
  const now = useNow(ready?.passes ?? NO_PASSES)
  const tz = place.timeZone

  const state = useMemo(() => (ready ? homeState(ready, now) : null), [ready, now])
  const model = state ? answerModel(state, focus, place.name, now, tz) : null
  const shown = model?.pass ?? null
  const tonight = ready?.nights[0]
  const night =
    ready?.nights.find(
      (n) =>
        shown &&
        n.evening.sunsetMs !== null &&
        Math.abs(shown.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
    ) ?? tonight

  const landmark = useMemo(() => {
    if (!shown || !catalog) return null
    return nearestLandmark(shown.track, skyScene(place, shown.peak.unixMs, catalog), catalog)
  }, [shown, catalog, place])

  // Motion permission has to be requested inside the tap (iOS).
  const goLive = async (m: StageMode) => {
    await requestMotionPermission()
    setMode(m)
    setSheet('peek')
  }

  return (
    <div className="min-h-dvh">
      <SkyStage
        place={place}
        passes={ready?.passes ?? NO_PASSES}
        focus={shown}
        catalog={catalog}
        red={nightMode}
        bottomInset={wide ? 0 : PEEK_PX}
        mode={mode}
        onModeChange={(m) => {
          setMode(m)
          if (m === 'sky') setSheet('peek')
        }}
      />

      <Sheet state={sheet} onState={setSheet} hidden={mode !== 'sky'}>
        {fc.status === 'error' ? (
          <div className="pt-2">
            <h1 className="text-2xl font-semibold">We couldn’t load the orbit data.</h1>
            <p className="mt-2 text-ink-2">Check your connection and reload. ({fc.message})</p>
          </div>
        ) : !ready || !model || !night || !tonight ? (
          <div aria-busy="true" className="pt-1">
            <p className="hud-caps text-ink-2">Tonight · {place.name}</p>
            <p className="hud mt-1 text-[5.5rem] leading-[0.86] font-bold text-ink-3/50 [font-stretch:62%]">
              –:––
            </p>
            <p className="mt-2 text-ink-3">Working out where the stations will be…</p>
          </div>
        ) : (
          <main>
            <Peek model={model} timeZone={tz} nowMs={now} />
            <div className="mt-7">
              <Details
                model={model}
                nights={ready.nights}
                landmark={landmark}
                placeName={place.name}
                timeZone={tz}
                onFindIt={() => void goLive('find')}
                onCamera={() => void goLive('camera')}
                onClearFocus={() => setFocus(null)}
                nightMode={nightMode}
                onNightMode={setNightMode}
              />
            </div>
            {shown && (
              <div className="mt-6">
                <DataAge
                  epochMs={ready.elements.find((e) => e.noradId === shown.noradId)?.epochMs ?? now}
                  nowMs={now}
                />
              </div>
            )}
            {shown && (
              <div className="mt-12">
                <CompassCard
                  pass={shown}
                  place={place}
                  sunsetAzDeg={night.evening.sunsetAzDeg}
                  nowMs={now}
                />
              </div>
            )}
            <div className="mt-12">
              <TonightStrip
                evening={tonight.evening}
                passes={ready.passes}
                timeZone={tz}
                bedtime={BEDTIME}
                selectedKey={shown ? passKey(shown) : undefined}
              />
            </div>
            <WeekBoard
              passes={ready.passes}
              timeZone={tz}
              nowMs={now}
              selectedKey={focus ? passKey(focus) : undefined}
              onSelect={(p) => {
                setFocus(p)
                setSheet('peek')
              }}
            />
            <AlsoTonight night={tonight} timeZone={tz} />
            <Footer />
          </main>
        )}
      </Sheet>
    </div>
  )
}

function useWide() {
  const q = '(min-width: 64rem)'
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.(q).matches ?? false),
  )
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
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
