// The one screen. It opens on a picture of tonight's pass as you'll see it,
// with the time on it; then how to find it, a live compass, the rest of the
// night and the week. "Find it in the sky" opens Sky View.
// Docs: docs/DESIGN.md
import { useEffect, useMemo, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import { nearestLandmark, skyScene } from '../engine/sky/scene.ts'
import { DEFAULT_PLACE } from '../presets.ts'
import { useForecast, useNow } from '../lib/hooks.ts'
import { homeState } from '../lib/state.ts'
import { formatDate } from '../lib/format.ts'
import { answerModel, Details, Headline } from '../ui/Answer.tsx'
import { Postcard } from '../ui/Postcard.tsx'
import { CompassCard } from '../ui/CompassCard.tsx'
import { TonightStrip, passKey } from '../ui/TonightStrip.tsx'
import { WeekBoard } from '../ui/WeekBoard.tsx'
import { AlsoTonight } from '../ui/AlsoTonight.tsx'
import { DataAge } from '../ui/DataAge.tsx'
import { TakeItOutside } from '../ui/TakeItOutside.tsx'
import { Footer } from '../ui/Chrome.tsx'
import { Logo } from '../brand/Logo.tsx'
import { SkyView } from '../ui/SkyView.tsx'
import { useStarCatalog } from '../sky/useStarCatalog.ts'
import { requestMotionPermission } from '../sky/useOrientation.ts'

const BEDTIME = '21:30' // family-mode default; configurable in v0.1
const NO_PASSES: never[] = []
const HERO = 'h-[min(78dvh,46rem)] min-h-[30rem]'

export function Home() {
  const place = DEFAULT_PLACE
  const fc = useForecast(place)
  const catalog = useStarCatalog()
  const [focus, setFocus] = useState<ForecastPass | null>(null)
  const [nightMode, setNightMode] = useNightMode()
  const [skyView, setSkyView] = useState<{ sensors: boolean } | null>(null)

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

  const openSkyView = async () => {
    // iOS only grants motion access inside the tap that asks for it.
    const sensors = await requestMotionPermission()
    setSkyView({ sensors })
  }

  const overlay = (content: React.ReactNode) => (
    <HeroOverlay placeName={place.name} dateLabel={formatDate(now, tz)}>
      {content}
    </HeroOverlay>
  )

  return (
    <div className="min-h-dvh">
      {/* Hero: tonight's sky with the answer on it */}
      {shown && model ? (
        <Postcard
          pass={shown}
          place={place}
          catalog={catalog}
          red={nightMode}
          nowMs={now}
          className={HERO}
        >
          {overlay(<Headline model={model} timeZone={tz} nowMs={now} />)}
        </Postcard>
      ) : (
        <div className={`relative bg-[linear-gradient(to_top,#18244a,#080c1a_70%)] ${HERO}`}>
          {overlay(
            fc.status === 'error' ? (
              <div>
                <h1 className="text-2xl font-semibold">We couldn’t load the orbit data.</h1>
                <p className="mt-2 text-white/75">
                  Check your connection and reload. ({fc.message})
                </p>
              </div>
            ) : model ? (
              <Headline model={model} timeZone={tz} nowMs={now} />
            ) : (
              <div aria-busy="true">
                <p className="text-base font-medium text-white/80">Tonight in {place.name}</p>
                <p className="tnum mt-1 text-[clamp(4.25rem,21vw,7rem)] leading-[0.92] font-semibold tracking-[-0.04em] text-white/25">
                  –:––
                </p>
                <p className="mt-3 text-lg text-white/60">
                  Working out where the stations will be…
                </p>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mx-auto max-w-[34rem] px-5 wide:max-w-6xl wide:px-10">
        {ready && model && night && tonight ? (
          <main className="wide:grid wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] wide:gap-16">
            <div className="pt-8">
              <Details
                model={model}
                nights={ready.nights}
                landmark={landmark}
                placeName={place.name}
                timeZone={tz}
                onFindIt={openSkyView}
                onClearFocus={() => setFocus(null)}
                nightMode={nightMode}
                onNightMode={setNightMode}
              />
              {shown && (
                <div className="mt-6">
                  <DataAge
                    epochMs={
                      ready.elements.find((e) => e.noradId === shown.noradId)?.epochMs ?? now
                    }
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
            </div>

            <div className="mt-14 wide:mt-8">
              <TonightStrip
                evening={tonight.evening}
                passes={ready.passes}
                timeZone={tz}
                bedtime={BEDTIME}
                selectedKey={shown ? passKey(shown) : undefined}
              />
              <WeekBoard
                passes={ready.passes}
                timeZone={tz}
                nowMs={now}
                selectedKey={focus ? passKey(focus) : undefined}
                onSelect={(p) => {
                  setFocus(p)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
              <AlsoTonight night={tonight} timeZone={tz} />
              <div className="mt-12">
                <TakeItOutside />
              </div>
            </div>
          </main>
        ) : (
          // Reserve space while loading so nothing jumps (CLS 0).
          <div className="min-h-[60dvh]" />
        )}
        <Footer />
      </div>

      {skyView && shown && (
        <SkyView
          pass={shown}
          place={place}
          sensorsAllowed={skyView.sensors}
          onClose={() => setSkyView(null)}
        />
      )}
    </div>
  )
}

function HeroOverlay({
  placeName,
  dateLabel,
  children,
}: {
  placeName: string
  dateLabel: string
  children: React.ReactNode
}) {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent">
        <div className="mx-auto flex max-w-[34rem] items-center justify-between gap-4 px-5 py-4 wide:max-w-6xl wide:px-10">
          <a
            href="/"
            className="flex items-center gap-2.5 rounded-sm text-white"
            aria-label="SkyPassAlert home"
          >
            <Logo size={26} title="" />
            <span className="text-[0.9375rem] font-semibold tracking-tight">SkyPassAlert</span>
          </a>
          <p className="text-right text-sm leading-tight text-white">
            <span className="block font-medium">{placeName}</span>
            <span className="block text-white/65">{dateLabel}</span>
          </p>
        </div>
      </header>
      <section
        aria-labelledby="answer"
        aria-live="polite"
        className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--night)] via-[color-mix(in_srgb,var(--night)_65%,transparent)] to-transparent pt-28 pb-6 text-white"
      >
        <div className="mx-auto max-w-[34rem] px-5 wide:max-w-6xl wide:px-10">{children}</div>
      </section>
    </>
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
