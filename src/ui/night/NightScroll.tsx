// The Tonight tab: one scroll through the night. The real sky is pinned
// behind the page and follows the clock as you scroll: sunset, first stars,
// each pass (scrolling scrubs the station along its real path), the Moon,
// the planets, sunrise. The first screen is still the answer (3-second rule).
// Docs: docs/DESIGN.md#the-night
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Forecast, ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { parseDateKey, zonedTimeToUnixMs } from '../../engine/time/zone.ts'
import { countdown, dayLabel, formatTime, timeParts } from '../../lib/format.ts'
import {
  brightnessSentence,
  direction,
  endNote,
  minutesLabel,
  moonPhaseName,
  NIGHT_COPY,
  pathSentence,
  PLANET_NAMES,
  planetLine,
  startCue,
  stationName,
  whereInSky,
} from '../../copy/en.ts'
import { stationLong, type AnswerModel } from '../Answer.tsx'
import { postcardView } from '../stageView.ts'
import { CalendarButton } from '../CalendarButton.tsx'
import { DataAge } from '../DataAge.tsx'
import { Footer } from '../Chrome.tsx'
import { TakeItOutside } from '../TakeItOutside.tsx'
import { IconArrow, IconCamera, IconPin, IconRed } from '../app/Icons.tsx'
import { buildNight, stopSpan, type Stop } from './buildNight.ts'
import {
  HERO_HORIZON_AT,
  HORIZON_AT,
  makeSceneCache,
  momentAt,
  paintMoment,
  type Keyframe,
  type SkyMoment,
} from './scrollSky.ts'

const WaveBack = lazy(() => import('../wave/WaveBack.tsx'))

const PHOTO: Record<string, { src: string; credit: string }> = {
  moon: { src: '/img/moon.webp', credit: 'NASA/GSFC (LRO)' },
  saturn: { src: '/img/saturn.webp', credit: 'NASA/JPL/Space Science Institute' },
  jupiter: { src: '/img/jupiter.webp', credit: 'NASA/JPL/Space Science Institute' },
  mars: { src: '/img/mars.webp', credit: 'NASA/JPL/USGS' },
  venus: { src: '/img/venus.webp', credit: 'NASA/JPL-Caltech' },
}

/** Where the reader's eye is: the clock is read at this height of the screen. */
const READ_AT = 0.55
const BEDTIME: [number, number] = [21, 30]

type Props = {
  forecast: Forecast
  model: AnswerModel
  place: Place
  catalog: StarCatalog | null
  nowMs: number
  nightMode: boolean
  onNightMode: (on: boolean) => void
  onChangePlace: () => void
  onFindIt: () => void
  onPhotograph: (targetId: string) => void
  onWeek: () => void
  onFocus: (p: ForecastPass | null) => void
}

export function NightScroll(props: Props) {
  const { forecast, model, place, catalog, nowMs } = props
  const tz = place.timeZone
  const focusMs = model.kind === 'focus' ? model.pass?.start.unixMs : undefined
  // Rebuild once a minute, not on every tick of the clock.
  const minute = Math.floor(nowMs / 60_000)
  const night = useMemo(
    () => buildNight(forecast, minute * 60_000, focusMs),
    [forecast, minute, focusMs],
  )
  const [wave, setWave] = useState<ForecastPass | null>(null)

  const rootRef = useRef<HTMLElement>(null)
  const section = (id: string) =>
    rootRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`) ?? null
  const framesRef = useRef<Keyframe[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)

  const hero = model.pass
  // On a night without a pass, the next one is a footnote, not the headline.
  const heroIsTonight = hero !== null && model.headline === undefined
  const skyPass = heroIsTonight ? hero : null
  const span = night ? night.endMs - night.startMs : 1
  const frac = (t: number) => (night ? Math.max(0, Math.min(1, (t - night.startMs) / span)) : 0)

  // Keyframes from where each section actually sits on the page.
  useLayoutEffect(() => {
    if (!night) return
    const build = () => {
      const vh = window.innerHeight
      const frames: Keyframe[] = []
      const heroEl = section('hero')
      // Without a pass tonight, open on the first thing worth seeing.
      const first =
        night.stops.find((s) => s.kind === 'moon' || s.kind === 'planet') ?? night.stops[0]
      const heroAz = skyPass ? postcardView(skyPass).az : (first?.face.azDeg ?? 180)
      const heroT = skyPass ? skyPass.peak.unixMs : (first?.atMs ?? night.startMs)
      if (heroEl)
        frames.push({
          y: vh * READ_AT,
          t: heroT,
          az: heroAz,
          pass: skyPass,
          horizon: heroIsTonight || model.kind === 'focus' ? HERO_HORIZON_AT : HORIZON_AT,
        })
      for (const s of night.stops) {
        const el = section(s.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        const h = el.offsetHeight
        const [t0, t1] = stopSpan(s)
        const pass = s.kind === 'pass' ? s.pass : null
        if (pass) {
          frames.push({ y: top + vh * READ_AT, t: t0, az: s.face.azDeg, pass, horizon: HORIZON_AT })
          frames.push({
            y: top + h - vh * (1 - READ_AT),
            t: t1,
            az: s.face.azDeg,
            pass,
            horizon: HORIZON_AT,
          })
        } else {
          frames.push({ y: top + h / 2, t: t0, az: s.face.azDeg, pass: null, horizon: HORIZON_AT })
        }
      }
      framesRef.current = frames.sort((a, b) => a.y - b.y)
      window.dispatchEvent(new Event('night:layout'))
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [night, skyPass, heroIsTonight, model.kind])

  // Paint the sky for the scrolled moment, at most once per frame.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !night) return
    const sceneAt = makeSceneCache(place, catalog)
    const fmtMinute = (ms: number) => formatTime(ms, tz).replace(/\s?[AP]M$/, '')
    let raf = 0
    let settle = 0
    let moving = false
    let last = ''
    const draw = () => {
      raf = 0
      const m: SkyMoment | null = momentAt(
        framesRef.current,
        window.scrollY + window.innerHeight * READ_AT,
      )
      if (!m) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      // Lower resolution while the finger is moving; full sharpness on settle.
      const dpr = moving ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      const key = `${Math.round(m.t / 1000)}|${m.az.toFixed(2)}|${m.horizon.toFixed(3)}|${m.pass?.start.unixMs}|${m.live}|${w}x${h}@${dpr}|${props.nightMode}`
      if (key !== last) {
        last = key
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          paintMoment(ctx, w, h, m, sceneAt(m.t), catalog, props.nightMode, fmtMinute)
        }
      }
      if (clockRef.current) clockRef.current.textContent = formatTime(m.t, tz)
      if (markerRef.current) markerRef.current.style.top = `${frac(m.t) * 100}%`
    }
    const request = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    const onScroll = () => {
      moving = true
      clearTimeout(settle)
      settle = window.setTimeout(() => {
        moving = false
        request()
      }, 140)
      request()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', request)
    window.addEventListener('night:layout', request)
    request()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', request)
      window.removeEventListener('night:layout', request)
    }
    // frac depends only on night; keeping it out avoids re-binding every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night, place, catalog, tz, props.nightMode])

  const jumpTo = (id: string) => {
    const el = section(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  }

  const bedtimeMs = night
    ? zonedTimeToUnixMs(tz, ...parseDateKey(night.night.evening.dateKey), ...BEDTIME)
    : 0
  const ev = night?.night.evening
  const nightOf =
    night && dayLabel(night.startMs, nowMs, tz) === 'Today'
      ? 'Tonight'
      : night
        ? `${dayLabel(night.startMs, nowMs, tz)} night`
        : 'Tonight'

  return (
    <main ref={rootRef} className="relative">
      {/* The sky, pinned behind everything. */}
      <div aria-hidden="true" className="fixed inset-0 -z-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 h-[64%] bg-gradient-to-t from-black/90 via-black/65 to-transparent" />
      </div>

      {/* Top bar: place, the clock you are looking at, night vision. */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <button
          type="button"
          onClick={props.onChangePlace}
          className="glass flex h-10 max-w-[45%] items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold ring-1 ring-white/10"
          aria-label={`Location: ${place.name}. Change`}
        >
          <IconPin className="size-4 shrink-0 text-action" />
          <span className="truncate">{place.name}</span>
        </button>
        <p className="hud text-[1.0625rem] font-semibold text-ink" aria-hidden="true">
          <span ref={clockRef} />
        </p>
        <button
          type="button"
          onClick={() => props.onNightMode(!props.nightMode)}
          aria-pressed={props.nightMode}
          aria-label="Night vision: dim red light keeps your eyes adjusted to the dark"
          className={`glass grid size-10 place-items-center rounded-full ring-1 ring-white/10 ${props.nightMode ? 'text-action' : 'text-ink-2'}`}
        >
          <IconRed className="size-5" />
        </button>
      </header>

      {/* The night's rail: real times, a tick per stop, where you are now. */}
      {night && (
        <nav
          aria-label="Jump to a time tonight"
          className="fixed top-1/2 right-1.5 z-20 h-[56svh] w-9 -translate-y-1/2"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/20" />
          {bedtimeMs > night.startMs && bedtimeMs < night.endMs && (
            <div
              className="absolute left-1.5 right-1.5 border-t border-dashed border-ink-3"
              style={{ top: `${frac(bedtimeMs) * 100}%` }}
              title="Bedtime, 9:30 PM"
            />
          )}
          {night.stops.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              aria-label={`${stopTitle(s)}, ${formatTime(s.atMs, tz)}`}
              className="absolute left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ top: `${frac(s.atMs) * 100}%` }}
            >
              <span
                className={`block rounded-full ${s.kind === 'pass' ? (s.dawn || s.weak ? 'size-2 bg-station/50' : 'size-2.5 bg-station') : s.kind === 'sunset' || s.kind === 'sunrise' ? 'size-2 bg-ink-2' : 'size-1.5 bg-ink'}`}
              />
            </button>
          ))}
          <div
            ref={markerRef}
            className="pointer-events-none absolute left-0 right-0 h-0.5 -translate-y-1/2 rounded-full bg-action shadow-[0_0_8px_var(--action)]"
          />
        </nav>
      )}

      {/* 1. The answer. */}
      <section
        data-id="hero"
        aria-labelledby="answer"
        className="relative z-10 flex min-h-[100svh] flex-col justify-end pr-14 pl-5 wide:pl-16 pb-[calc(env(safe-area-inset-bottom)+7rem)]"
      >
        <h1 id="answer" className="hud-caps text-ink-2">
          {model.kind === 'look-now' ? 'Up right now' : model.eyebrow}
        </h1>
        {model.headline && (
          <p className="display mt-3 text-[clamp(2.5rem,12vw,3.5rem)] leading-[0.95] tracking-[-0.03em] text-balance">
            {model.headline}
          </p>
        )}
        {hero && !heroIsTonight ? (
          <>
            <p className="mt-3 max-w-[30rem] text-[1.0625rem] leading-snug text-ink-2">
              {model.sub}
            </p>
            <button
              type="button"
              onClick={() => props.onFocus(hero)}
              className="mt-5 flex items-center gap-3 self-start rounded-2xl bg-white/[0.07] py-2.5 pr-4 pl-3 text-left ring-1 ring-white/12"
            >
              <span aria-hidden="true" className="size-2.5 rounded-full bg-station" />
              <span>
                <span className="block text-[0.75rem] text-ink-2">
                  Next: {dayLabel(hero.start.unixMs, nowMs, tz)}
                </span>
                <span className="display tnum block text-[1.125rem]">
                  {formatTime(hero.start.unixMs, tz)} · {stationName(hero.noradId).short}
                </span>
              </span>
              <IconArrow className="ml-2 size-4 text-action" />
            </button>
          </>
        ) : hero ? (
          <>
            <p className="mt-3 flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-station" />
              <span className="text-[0.9375rem] font-semibold">{stationLong(hero.noradId)}</span>
            </p>
            <BigTime ms={hero.start.unixMs} tz={tz} size="xl" />
            {hero.start.unixMs > nowMs && dayLabel(hero.start.unixMs, nowMs, tz) === 'Today' && (
              <p className="hud mt-1 text-[1.0625rem] text-station">
                {countdown(hero.start.unixMs - nowMs)}
              </p>
            )}
            <p className="mt-3 max-w-[30rem] text-[1.0625rem] leading-snug text-pretty text-ink">
              {pathSentence(hero)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={props.onFindIt}
                className="display flex items-center gap-2 rounded-full bg-action px-5 py-3 text-[0.9375rem] text-action-ink"
              >
                Find it <IconArrow className="size-4" />
              </button>
              <CalendarButton pass={hero} placeName={place.name} timeZone={tz} />
              <button
                type="button"
                onClick={() => setWave(hero)}
                className="display flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-3 text-[0.9375rem] ring-1 ring-white/15"
              >
                <IconGlobe className="size-4.5" /> Their view
              </button>
            </div>
            {model.kind === 'focus' && (
              <button
                type="button"
                onClick={() => props.onFocus(null)}
                className="mt-4 self-start text-sm text-ink-2 underline underline-offset-4"
              >
                Back to tonight
              </button>
            )}
          </>
        ) : (
          <p className="mt-3 text-ink-2">
            No good passes in the next week. The Moon and planets are below.
          </p>
        )}
        <p className="mt-5 flex items-center gap-2 text-[0.8125rem] text-ink-3">
          <span aria-hidden="true" className="inline-block h-6 w-px bg-ink-3" />
          Scroll to move through {nightOf.toLowerCase()}
        </p>
      </section>

      {/* 2. The night, stop by stop. */}
      {night?.stops.map((s) => (
        <section
          key={s.id}
          data-id={s.id}
          data-stop={s.kind}
          aria-label={`${stopTitle(s)}, ${formatTime(s.atMs, tz)}`}
          className={`relative z-10 ${s.kind === 'pass' ? 'h-[190svh]' : 'h-[95svh]'}`}
        >
          <div className="pointer-events-none sticky top-0 flex h-[100svh] flex-col justify-end pr-14 pl-5 wide:pl-16 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
            <div className="pointer-events-auto">
              <StopBody
                stop={s}
                forecast={forecast}
                tz={tz}
                placeName={place.name}
                nowMs={nowMs}
                onWave={setWave}
                onFindIt={props.onFindIt}
                onPhotograph={props.onPhotograph}
              />
            </div>
          </div>
        </section>
      ))}

      {/* 3. The rest of the week, data age and credits on solid ground. */}
      <section className="relative z-10 bg-night px-5 pt-10 pb-32 wide:px-16">
        <h2 className="display text-[1.5rem]">After {nightOf.toLowerCase()}</h2>
        <p className="mt-2 text-ink-2">
          {ev?.sunriseMs ? `Sunrise ${formatTime(ev.sunriseMs, tz)}. ` : ''}
          Every pass for the next eight days is in the week view.
        </p>
        <button
          type="button"
          onClick={props.onWeek}
          className="display mt-4 flex items-center gap-2 rounded-full bg-action px-5 py-3 text-action-ink"
        >
          See the week <IconArrow className="size-4" />
        </button>
        {hero && (
          <div className="mt-8">
            <DataAge
              epochMs={forecast.elements.find((e) => e.noradId === hero.noradId)?.epochMs ?? nowMs}
              nowMs={nowMs}
            />
          </div>
        )}
        <div className="mt-8">
          <TakeItOutside />
        </div>
        <Footer />
      </section>

      {wave && (
        <Suspense fallback={null}>
          <WaveBack
            pass={wave}
            place={place}
            catalog={catalog}
            red={props.nightMode}
            onClose={() => setWave(null)}
          />
        </Suspense>
      )}
    </main>
  )
}

function stopTitle(s: Stop): string {
  switch (s.kind) {
    case 'sunset':
      return 'Sunset'
    case 'dark':
      return 'First stars'
    case 'pass':
      return stationName(s.pass.noradId).short
    case 'moon':
      return 'The Moon'
    case 'planet':
      return PLANET_NAMES[s.planet.id] ?? s.planet.id
    case 'sunrise':
      return 'Sunrise'
  }
}

function StopBody({
  stop: s,
  forecast,
  tz,
  placeName,
  nowMs,
  onWave,
  onFindIt,
  onPhotograph,
}: {
  stop: Stop
  forecast: Forecast
  tz: string
  placeName: string
  nowMs: number
  onWave: (p: ForecastPass) => void
  onFindIt: () => void
  onPhotograph: (id: string) => void
}) {
  const title = stopTitle(s)
  if (s.kind === 'pass') {
    const p = s.pass
    const sunsetAz =
      forecast.nights.find(
        (n) => n.evening.sunsetMs !== null && Math.abs(p.start.unixMs - n.evening.sunsetMs) < 36e6,
      )?.evening.sunsetAzDeg ?? null
    const note = endNote(p)
    return (
      <article>
        <p className="hud-caps flex items-center gap-2 text-ink-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-station" />
          {stationLong(p.noradId)}
          {s.dawn && <span className="text-ink-2">· early risers</span>}
          {s.weak && <span className="text-ink-2">· low or faint</span>}
        </p>
        <BigTime ms={p.start.unixMs} tz={tz} size="lg" />
        <p className="mt-2 max-w-[30rem] text-[1rem] leading-snug text-pretty">{pathSentence(p)}</p>
        <details className="group mt-2 max-w-[30rem] text-[0.9375rem] text-ink-2">
          <summary className="cursor-pointer list-none text-[0.875rem] font-semibold text-action">
            How to find it{' '}
            <span
              aria-hidden="true"
              className="inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            <li>{startCue(p, sunsetAz, !s.dawn)}</li>
            <li>
              {brightnessSentence(p.brightestMagnitude)} About{' '}
              {minutesLabel(p.end.unixMs - p.start.unixMs)}.
            </li>
            {note && <li>{note}</li>}
            {s.weak && <li>{NIGHT_COPY.weakPass}</li>}
          </ul>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onWave(p)}
            className="display flex items-center gap-2 rounded-full bg-action px-4 py-2.5 text-[0.875rem] text-action-ink"
          >
            <IconGlobe className="size-4.5" /> See it from the station
          </button>
          {p.end.unixMs > nowMs && <CalendarButton pass={p} placeName={placeName} timeZone={tz} />}
        </div>
        <p className="mt-2.5 text-[0.75rem] text-ink-3">
          Keep scrolling: the station moves along its real path.
        </p>
      </article>
    )
  }
  if (s.kind === 'moon' || s.kind === 'planet') {
    const id = s.kind === 'moon' ? 'moon' : s.planet.id
    const photo = PHOTO[id]
    const az = s.kind === 'moon' ? s.moon.azDeg : s.planet.azDeg
    const el = s.kind === 'moon' ? s.moon.elDeg : s.planet.elDeg
    return (
      <article>
        <div className="flex items-end gap-4">
          {photo && (
            <img
              src={photo.src}
              alt=""
              width={72}
              height={72}
              loading="lazy"
              className="size-[4.5rem] shrink-0 rounded-full object-cover ring-1 ring-white/15"
            />
          )}
          <div>
            <p className="hud-caps text-ink-2">
              {s.kind === 'moon' ? 'Around' : 'Highest around'} {formatTime(s.atMs, tz)}
            </p>
            <h2 className="display text-[2.5rem] leading-none">{title}</h2>
          </div>
        </div>
        <p className="mt-3 max-w-[30rem] text-[1.0625rem] leading-snug">
          {s.kind === 'moon'
            ? `${moonPhaseName(s.moon.illumination, s.moon.waxing)}, ${Math.round(s.moon.illumination * 100)}% lit. ${capitalise(whereInSky(az, el))}.`
            : `${capitalise(whereInSky(az, el))}. ${planetLine(s.planet.magnitude)}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onPhotograph(id)}
            className="display flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2.5 text-[0.875rem] ring-1 ring-white/15"
          >
            <IconCamera className="size-4.5" /> Photograph
          </button>
          <button
            type="button"
            onClick={onFindIt}
            className="display flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2.5 text-[0.875rem] ring-1 ring-white/15"
          >
            Find it <IconArrow className="size-4" />
          </button>
        </div>
        {photo && <p className="mt-3 text-[10px] text-ink-3">Photo: {photo.credit}</p>}
      </article>
    )
  }
  return (
    <article>
      <p className="hud-caps text-ink-2">{formatTime(s.atMs, tz)}</p>
      <h2 className="display mt-1 text-[2.5rem] leading-none">{title}</h2>
      <p className="mt-3 max-w-[30rem] text-[1.0625rem] leading-snug text-ink-2">
        {s.kind === 'sunset'
          ? NIGHT_COPY.sunset(direction(s.face.azDeg))
          : s.kind === 'dark'
            ? NIGHT_COPY.dark
            : NIGHT_COPY.sunrise}
      </p>
    </article>
  )
}

const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

function BigTime({ ms, tz, size }: { ms: number; tz: string; size: 'md' | 'lg' | 'xl' }) {
  const { clock, period } = timeParts(ms, tz)
  const cls =
    size === 'xl'
      ? 'text-[clamp(5rem,26vw,8rem)]'
      : size === 'lg'
        ? 'text-[clamp(3.5rem,17vw,5.5rem)]'
        : 'text-[clamp(3rem,15vw,4.5rem)]'
  return (
    <p className={`display tnum mt-1 leading-[0.86] tracking-[-0.045em] ${cls}`}>
      {clock}
      <span className="ml-2 align-top text-[1.125rem] font-semibold tracking-normal text-ink-2">
        {period}
      </span>
    </p>
  )
}

export function IconGlobe({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.5 5.1 3.5 8.5s-1.1 6.2-3.5 8.5c-2.4-2.3-3.5-5.1-3.5-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  )
}
