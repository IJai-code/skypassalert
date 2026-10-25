// The app shell: four tabs (Tonight, Sky, Camera, Passes) over one forecast
// for the chosen place. Tonight is a scrolling page of cards; Sky and Camera
// are full-screen live views; Passes is the week.
// Docs: docs/DESIGN.md
import { useEffect, useMemo, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { nearestLandmark, skyScene } from '../engine/sky/scene.ts'
import { useForecast, useNow } from '../lib/hooks.ts'
import { homeState } from '../lib/state.ts'
import { loadSavedPlace, savePlace } from '../lib/places.ts'
import { answerModel } from '../ui/Answer.tsx'
import { SkyStage } from '../ui/SkyStage.tsx'
import { TabBar, type Tab } from '../ui/app/TabBar.tsx'
import { TonightScreen } from '../ui/app/TonightScreen.tsx'
import { PassesScreen } from '../ui/app/PassesScreen.tsx'
import { PlacePicker } from '../ui/app/PlacePicker.tsx'
import { useStarCatalog } from '../sky/useStarCatalog.ts'
import { requestMotionPermission } from '../sky/useOrientation.ts'

const NO_PASSES: never[] = []
const TAB_BAR_PX = 88

export function Home() {
  const [place, setPlaceState] = useState<Place>(loadSavedPlace)
  const fc = useForecast(place)
  const catalog = useStarCatalog()
  const [focus, setFocus] = useState<ForecastPass | null>(null)
  const [nightMode, setNightMode] = useNightMode()
  const [tab, setTab] = useState<Tab>('tonight')
  const [cameraTarget, setCameraTarget] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const ready = fc.status === 'ready' ? fc.forecast : null
  const now = useNow(ready?.passes ?? NO_PASSES)
  const tz = place.timeZone

  const state = useMemo(() => (ready ? homeState(ready, now) : null), [ready, now])
  const model = state ? answerModel(state, focus, place.name, now, tz) : null
  const shown = model?.pass ?? null

  const landmark = useMemo(() => {
    if (!shown || !catalog) return null
    return nearestLandmark(shown.track, skyScene(place, shown.peak.unixMs, catalog), catalog)
  }, [shown, catalog, place])

  // Live tabs need motion access, which iOS only grants inside the tap.
  const go = async (t: Tab) => {
    if ((t === 'sky' || t === 'camera') && tab !== 'sky' && tab !== 'camera')
      await requestMotionPermission()
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  const setPlace = (p: Place) => {
    savePlace(p)
    setPlaceState(p)
    setFocus(null)
    setPicking(false)
  }

  return (
    <div className="min-h-dvh">
      {(tab === 'sky' || tab === 'camera') && (
        <SkyStage
          key={tab}
          place={place}
          passes={ready?.passes ?? NO_PASSES}
          focus={shown}
          catalog={catalog}
          red={nightMode}
          bottomInset={TAB_BAR_PX}
          mode={tab === 'camera' ? 'camera' : 'find'}
          initialTargetId={tab === 'camera' ? cameraTarget : null}
        />
      )}

      {tab === 'tonight' &&
        (ready && model ? (
          <TonightScreen
            forecast={ready}
            model={model}
            place={place}
            catalog={catalog}
            landmark={landmark}
            nowMs={now}
            nightMode={nightMode}
            onNightMode={setNightMode}
            onChangePlace={() => setPicking(true)}
            onFindIt={() => void go('sky')}
            onPhotograph={(id) => {
              setCameraTarget(id)
              void go('camera')
            }}
            onSeeAllPasses={() => void go('passes')}
            onFocus={(p) => {
              setFocus(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        ) : (
          <Loading placeName={place.name} error={fc.status === 'error' ? fc.message : null} />
        ))}

      {tab === 'passes' && ready && (
        <PassesScreen
          forecast={ready}
          place={place}
          catalog={catalog}
          nowMs={now}
          onOpen={(p) => {
            setFocus(p)
            void go('tonight')
          }}
        />
      )}

      <TabBar tab={tab} onTab={(t) => void go(t)} />
      {picking && (
        <PlacePicker current={place} onPick={setPlace} onClose={() => setPicking(false)} />
      )}
    </div>
  )
}

function Loading({ placeName, error }: { placeName: string; error: string | null }) {
  return (
    <main
      className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),16px)] pb-32"
      aria-busy={!error}
    >
      <div className="flex items-center gap-3 pb-4">
        <span className="size-11 rounded-full bg-surface-2" />
        <div>
          <p className="display text-[1.0625rem]">Look up tonight</p>
          <p className="text-[0.8125rem] text-ink-2">{placeName}</p>
        </div>
      </div>
      <div className="card h-[31rem] p-5">
        {error ? (
          <>
            <h1 className="display text-xl">We couldn’t load the orbit data.</h1>
            <p className="mt-2 text-ink-2">Check your connection and reload. ({error})</p>
          </>
        ) : (
          <div className="flex h-full flex-col justify-end">
            <p className="text-[0.8125rem] text-ink-2">Tonight in {placeName}</p>
            <p className="display mt-1 text-[4.25rem] leading-[0.95] text-ink-3/40">–:––</p>
            <p className="mt-2 text-ink-3">Working out where the stations will be…</p>
          </div>
        )}
      </div>
    </main>
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
      ?.setAttribute('content', on ? '#000000' : '#061219')
    try {
      sessionStorage.setItem('spa:night', on ? '1' : '0')
    } catch {
      // ignore
    }
  }, [on])
  return [on, setOn]
}
