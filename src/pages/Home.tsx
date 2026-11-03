// The app shell: three tabs over one forecast for the chosen place.
// Tonight is one scroll through the night over the real sky; Sky is the live
// view (find things, or photograph them); Week is every pass for 8 days.
// Docs: docs/DESIGN.md
import { useEffect, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { useForecast, useNow } from '../lib/hooks.ts'
import { homeState } from '../lib/state.ts'
import { loadSavedPlace, savePlace } from '../lib/places.ts'
import { answerModel } from '../ui/Answer.tsx'
import { SkyStage } from '../ui/SkyStage.tsx'
import { TabBar, type Tab } from '../ui/app/TabBar.tsx'
import { NightScroll } from '../ui/night/NightScroll.tsx'
import { PassesScreen } from '../ui/app/PassesScreen.tsx'
import { PlacePicker } from '../ui/app/PlacePicker.tsx'
import { useStarCatalog } from '../sky/useStarCatalog.ts'
import { requestMotionPermission } from '../sky/useOrientation.ts'

const NO_PASSES: never[] = []
const TAB_BAR_PX = 88
const SWITCH_PX = 52

export function Home() {
  const [place, setPlaceState] = useState<Place>(loadSavedPlace)
  const fc = useForecast(place)
  const catalog = useStarCatalog()
  const [focus, setFocus] = useState<ForecastPass | null>(null)
  const [nightMode, setNightMode] = useNightMode()
  const [tab, setTab] = useState<Tab>('tonight')
  const [skyMode, setSkyMode] = useState<'find' | 'camera'>('find')
  const [cameraTarget, setCameraTarget] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const ready = fc.status === 'ready' ? fc.forecast : null
  const now = useNow(ready?.passes ?? NO_PASSES)
  const tz = place.timeZone

  const state = ready ? homeState(ready, now) : null
  const model = state ? answerModel(state, focus, place.name, now, tz) : null
  const shown = model?.pass ?? null

  // The live view needs motion access, which iOS only grants inside the tap.
  const go = async (t: Tab, mode: 'find' | 'camera' = 'find') => {
    if (t === 'sky' && tab !== 'sky') await requestMotionPermission()
    if (t === 'sky') setSkyMode(mode)
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
      {tab === 'sky' && (
        <>
          <SkyStage
            key={skyMode}
            place={place}
            passes={ready?.passes ?? NO_PASSES}
            focus={shown}
            catalog={catalog}
            red={nightMode}
            bottomInset={TAB_BAR_PX + SWITCH_PX}
            mode={skyMode}
            initialTargetId={skyMode === 'camera' ? cameraTarget : null}
          />
          <SkySwitch
            mode={skyMode}
            onMode={(m) => {
              if (m === 'find') setCameraTarget(null)
              setSkyMode(m)
            }}
          />
        </>
      )}

      {tab === 'tonight' &&
        (ready && model ? (
          <NightScroll
            forecast={ready}
            model={model}
            place={place}
            catalog={catalog}
            nowMs={now}
            nightMode={nightMode}
            onNightMode={setNightMode}
            onChangePlace={() => setPicking(true)}
            onFindIt={() => void go('sky')}
            onPhotograph={(id) => {
              setCameraTarget(id)
              void go('sky', 'camera')
            }}
            onWeek={() => void go('week')}
            onFocus={(p) => {
              setFocus(p)
              window.scrollTo({ top: 0 })
            }}
          />
        ) : (
          <Loading placeName={place.name} error={fc.status === 'error' ? fc.message : null} />
        ))}

      {tab === 'week' && ready && (
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
      className="flex min-h-[100svh] flex-col justify-end bg-[linear-gradient(to_bottom,#05070f,#0b1428_58%,#05070f_60%)] pr-14 pl-5 pb-[calc(env(safe-area-inset-bottom)+7rem)]"
      aria-busy={!error}
    >
      {error ? (
        <>
          <h1 className="display text-xl">We couldn’t load the orbit data.</h1>
          <p className="mt-2 text-ink-2">Check your connection and reload. ({error})</p>
        </>
      ) : (
        <>
          <p className="hud-caps text-ink-2">Tonight in {placeName}</p>
          <p className="display tnum mt-4 text-[clamp(5.5rem,30vw,9rem)] leading-[0.86] tracking-[-0.045em] text-ink-3/40">
            –:––
          </p>
          <p className="mt-3 text-ink-3">Working out where the stations will be…</p>
        </>
      )}
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

function SkySwitch({
  mode,
  onMode,
}: {
  mode: 'find' | 'camera'
  onMode: (m: 'find' | 'camera') => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Sky view"
      className="glass fixed left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-1 ring-1 ring-white/10"
      style={{ bottom: `calc(max(env(safe-area-inset-bottom), 12px) + ${TAB_BAR_PX - 12}px)` }}
    >
      {(
        [
          ['find', 'Find'],
          ['camera', 'Photograph'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={mode === id}
          onClick={() => onMode(id)}
          className={`rounded-full px-4 py-1.5 text-[0.8125rem] font-semibold ${mode === id ? 'bg-white/15 text-ink' : 'text-ink-2'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
