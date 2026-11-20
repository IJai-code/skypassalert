// The top of the Tonight page as a film you scroll (D-033). A sticky stage
// holds the sky; scrolling plays the real pass across it, then rises to orbit.
// This part ships in the first bundle and works without WebGL: a 2D picture
// (drawSky) that scrubs with the scroll, the answer set on the ground, the
// clock line, the scrub rail and the captions. The WebGL film (Flight.tsx)
// loads on your first touch and takes over the picture when it's ready.
// Docs: docs/DESIGN.md#flight · Learn: docs/learn/16-the-flight.md
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ForecastPass, LiveOrbit } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { skyScene, type SkyScene } from '../../engine/sky/scene.ts'
import { subsolarPoint, sunElevationAt } from '../../engine/sky/subpoint.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import {
  direction,
  duskCaption,
  endNote,
  fistsLabel,
  FLIGHT_COPY,
  flightOrbitCaption,
  stationName,
} from '../../copy/en.ts'
import { formatTime } from '../../lib/format.ts'
import { drawSky } from '../../sky/drawSky.ts'
import { distanceKm, sampleAt } from '../wave/station.ts'
import { groundView, lookAt, passRig, turnSky } from './camera.ts'
import type { FilmInput, Highlight } from './film.ts'
import { Progress } from './progress.ts'
import { at, duskTimeline, passTimeline, progressForClock, type Timeline } from './timeline.ts'

const Flight = lazy(() => import('./Flight.tsx'))

export type StageInput =
  | { kind: 'pass'; pass: ForecastPass }
  | {
      kind: 'dusk'
      fromMs: number
      toMs: number
      faceAz: number
      highlight: Highlight | null
      live: readonly LiveOrbit[]
    }

type Props = {
  place: Place
  input: StageInput
  nowMs: number
  catalog: StarCatalog | null
  red: boolean
  simple: boolean
  /** Running head, set over the top of the sky. */
  head: ReactNode
  /** The answer, set on the ground below the horizon. */
  ground: ReactNode
  /** Id of the answer's heading, which names this section. */
  labelledBy: string
}

const PAPER = { day: '#0d1118', red: '#000000' }

/**
 * Can this device fly? WebGL2 and not a low-memory phone. Checked without
 * creating a GPU context, so it costs nothing at first paint. jsdom (tests)
 * has no WebGL2, so tests get the still picture.
 */
function canFly(): boolean {
  if (typeof window === 'undefined' || typeof WebGL2RenderingContext === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return false
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) return false
  return true
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export function FlightStage(props: Props) {
  const { place, input, nowMs, catalog, red, simple } = props
  const tz = place.timeZone
  const pass = input.kind === 'pass' ? input.pass : null

  const [capable] = useState(canFly)
  const [reduced] = useState(prefersReducedMotion)
  const [wanted, setWanted] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const filmOn = capable && wanted && !failed

  // While the station is up, "now" moves the opening moment; otherwise it doesn't matter.
  const live =
    pass && nowMs >= pass.start.unixMs && nowMs <= pass.end.unixMs ? Math.floor(nowMs / 1000) : 0
  const tl: Timeline = useMemo(
    () =>
      input.kind === 'pass'
        ? passTimeline(input.pass.start.unixMs, input.pass.end.unixMs, live * 1000)
        : duskTimeline(input.fromMs, input.toMs),
    [input, live],
  )
  const rig = useMemo(() => (pass ? passRig(pass) : null), [pass])
  const filmKey = pass
    ? `p${pass.noradId}-${pass.start.unixMs}`
    : input.kind === 'dusk'
      ? `d${input.fromMs}`
      : ''
  const face = useMemo(() => {
    if (rig) return { azDeg: rig.az0 }
    if (input.kind !== 'dusk') return { azDeg: 0 }
    return {
      azDeg: input.faceAz,
      elDeg: input.highlight ? azElOf(input.highlight.dir).elDeg : undefined,
    }
  }, [rig, input])

  const filmInput: FilmInput = useMemo(
    () =>
      input.kind === 'pass'
        ? { kind: 'pass', place, pass: input.pass, nowMs: live * 1000, catalog }
        : {
            kind: 'dusk',
            place,
            fromMs: input.fromMs,
            toMs: input.toMs,
            faceAz: input.faceAz,
            highlight: input.highlight,
            live: input.live,
            catalog,
          },
    [input, place, live, catalog],
  )

  const progress = useMemo(() => new Progress(reduced), [reduced])
  useEffect(() => () => progress.stop(), [progress])

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const posterRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLParagraphElement>(null)
  const captionRef = useRef<HTMLParagraphElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)

  // Scroll → target progress. Native scrolling; we only read it.
  useEffect(() => {
    if (!capable) return
    let raf = 0
    const read = (jump = false) => {
      raf = 0
      const root = rootRef.current
      const stage = stageRef.current
      if (!root || !stage) return
      const r = root.getBoundingClientRect()
      const span = r.height - stage.clientHeight
      const p = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0
      if (jump) progress.jump(p)
      else progress.set(p)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => read())
    }
    // A new film (another pass, another night) cuts to where you are; no glide.
    read(true)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    // Keyed on filmKey, not tl: tl ticks every second while the station is up.
  }, [capable, progress, filmKey])

  // Start the film as soon as the page has painted the answer (or sooner, on a touch).
  useEffect(() => {
    if (!capable) return
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 200) as unknown as number)
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const go = () => setWanted(true)
    const id = idle(go, { timeout: 1200 })
    const evs = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'] as const
    for (const e of evs) window.addEventListener(e, go, { once: true, passive: true })
    return () => {
      cancel(id)
      for (const e of evs) window.removeEventListener(e, go)
    }
  }, [capable])

  // Stars for the still picture (cached; on dusk nights refreshed as the sky turns).
  const sceneCache = useRef<{ key: string; scene: SkyScene } | null>(null)
  const sceneAt = (t: number): SkyScene => {
    const ref = pass ? pass.peak.unixMs : Math.round(t / 120_000) * 120_000
    const key = `${place.latDeg},${place.lonDeg},${ref},${catalog ? 1 : 0}`
    if (sceneCache.current?.key !== key)
      sceneCache.current = { key, scene: skyScene(place, ref, catalog) }
    return sceneCache.current.scene
  }

  // Everything the stage updates per frame, without React re-rendering.
  useEffect(() => {
    const minute = (ms: number) => formatTime(ms, tz).replace(/\s?[AP]M$/, '')
    let lastCaption = ''
    let lastValue = ''

    const drawPoster = (p: number) => {
      const c = posterRef.current
      if (!c || (ready && !failed)) return
      const w = c.clientWidth
      const h = c.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr)
      if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr)
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const a = at(tl, p, reduced)
      // The 2D picture can't fly: while the film loads, the opening shot is plain space.
      if (capable && !failed && a.lift > 0) {
        ctx.clearRect(0, 0, w, h)
        return
      }
      const hl = input.kind === 'dusk' ? input.highlight : null
      // On a pass-free night the thing to see moves with the sky; follow it.
      const hlNow = hl ? azElOf(turnSky(hl.dir, place.latDeg, a.clockMs - hl.refMs)) : null
      const cam = groundView(rig, hlNow ?? face, a, { width: w, height: h })
      const look = pass && rig ? lookAt(rig.track, a.clockMs) : null
      const sunlit = pass ? sampleAt(pass.station.samples, a.clockMs).sunlit : 0
      drawSky(ctx, {
        vp: { width: w, height: h, vfovDeg: cam.vfovDeg, projection: 'rectilinear' },
        cam,
        scene: sceneAt(a.clockMs),
        catalog,
        opaque: true,
        red,
        track: pass?.track ?? null,
        station: look && sunlit > 0.3 ? look : null,
        formatMinute: minute,
        labels: true,
        groundColor: red ? PAPER.red : PAPER.day,
        highlight: hl && hlNow ? { ...hlNow, label: hl.label } : null,
      })
    }

    const update = (p: number) => {
      const a = at(tl, p, reduced)
      const stage = stageRef.current
      if (stage) {
        stage.style.setProperty('--dock', a.dock.toFixed(3))
        stage.style.setProperty('--lift', a.lift.toFixed(3))
      }

      // The docked clock line: the film's time and where the station is.
      const clock = clockRef.current
      if (clock) {
        let text = formatTime(a.clockMs, tz)
        if (pass && rig && a.lift < 0.5) {
          const look = lookAt(rig.track, a.clockMs)
          text += ` · ${direction(look.azDeg)}, ${fistsLabel(look.elDeg)} up`
        }
        if (clock.textContent !== text) clock.textContent = text
      }

      // One sentence for what you're looking at, swapped (not animated) per beat.
      let caption = ''
      if (pass && a.beat === 'pass' && a.clockMs >= pass.end.unixMs - 20_000)
        caption = endNote(pass, simple) ?? ''
      if (pass && a.lift > 0.55 && capable && !failed) {
        const smp = sampleAt(pass.station.samples, a.clockMs)
        caption = flightOrbitCaption({
          station: stationName(pass.noradId).long.replace(/^the /, ''),
          time: formatTime(a.clockMs, tz),
          heightKm: smp.heightKm,
          distanceKm: distanceKm(place, smp),
          sunlit: smp.sunlit,
          yourSunDeg: sunElevationAt(place, subsolarPoint(a.clockMs)),
          simple,
        })
      }
      if (!pass && a.lift > 0.55 && capable && !failed) caption = FLIGHT_COPY.liveNow
      if (!pass && a.beat === 'dusk')
        caption = duskCaption(sunElevationAt(place, subsolarPoint(a.clockMs)), simple)
      const cap = captionRef.current
      if (cap && caption !== lastCaption) {
        lastCaption = caption
        cap.textContent = caption
        cap.dataset.on = caption ? '1' : '0'
      }

      // The rail: thumb position and what a screen reader hears.
      const span = tl.clock1 - tl.clock0
      const f = span > 0 ? (a.clockMs - tl.clock0) / span : 0
      thumbRef.current?.style.setProperty('--f', f.toFixed(4))
      const rail = railRef.current
      if (rail) {
        const secs = Math.round((a.clockMs - tl.clock0) / 1000)
        const value = `${secs}`
        if (value !== lastValue) {
          lastValue = value
          rail.setAttribute('aria-valuenow', value)
          rail.setAttribute('aria-valuetext', clock?.textContent ?? '')
        }
        rail.dataset.on = a.dock > 0.5 && a.lift < 0.3 ? '1' : '0'
      }

      drawPoster(p)
    }
    const unsub = progress.subscribe(update)
    const ro = new ResizeObserver(() => progress.poke())
    if (posterRef.current) ro.observe(posterRef.current)
    return () => {
      unsub()
      ro.disconnect()
    }
    // sceneAt reads refs and props captured fresh on every effect run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    progress,
    tl,
    rig,
    face,
    pass,
    input,
    catalog,
    red,
    simple,
    reduced,
    ready,
    failed,
    capable,
    place,
    tz,
  ])

  // Scrub rail: dragging or keys move the page, so scroll stays the one clock.
  const scrollToClock = (clockMs: number) => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const r = root.getBoundingClientRect()
    const span = r.height - stage.clientHeight
    const p = progressForClock(tl, clockMs)
    window.scrollTo({ top: window.scrollY + r.top + p * span, behavior: 'instant' })
  }
  const clockNow = () => at(tl, progress.value, reduced).clockMs
  const onRailPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    scrollToClock(tl.clock0 + f * (tl.clock1 - tl.clock0))
  }
  const step = pass ? 10_000 : 5 * 60_000
  const onRailKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowUp: -step,
      ArrowLeft: -step,
      ArrowDown: step,
      ArrowRight: step,
      PageUp: -step * 6,
      PageDown: step * 6,
    }
    if (e.key === 'Home') scrollToClock(tl.clock0)
    else if (e.key === 'End') scrollToClock(tl.clock1)
    else if (moves[e.key] !== undefined) scrollToClock(clockNow() + (moves[e.key] ?? 0))
    else return
    e.preventDefault()
  }

  const ticks = useMemo(() => {
    const every = pass ? 60_000 : 30 * 60_000
    const out: Array<{ f: number; label: string }> = []
    const span = tl.clock1 - tl.clock0
    if (span <= 0) return out
    for (let t = Math.ceil(tl.clock0 / every) * every; t <= tl.clock1; t += every)
      out.push({ f: (t - tl.clock0) / span, label: formatTime(t, tz).replace(/\s?[AP]M$/, '') })
    return out
  }, [tl, pass, tz])

  return (
    <section
      ref={rootRef}
      aria-labelledby={props.labelledBy}
      className="flight"
      style={{ height: capable ? `${tl.screens * 100}svh` : undefined }}
    >
      <div
        ref={stageRef}
        className="flight-stage"
        data-film={ready && !failed ? '1' : '0'}
        // Decided once, before the first paint: if the GPU later fails, the 2D
        // picture takes over behind the same layout, so nothing jumps.
        data-fly={capable ? '1' : '0'}
      >
        <canvas ref={posterRef} className="flight-poster" aria-hidden="true" />
        {filmOn && (
          <Suspense fallback={null}>
            <Flight
              input={filmInput}
              progress={progress}
              red={red}
              reduced={reduced}
              paper={red ? PAPER.red : PAPER.day}
              formatMinute={(ms) => formatTime(ms, tz).replace(/\s?[AP]M$/, '')}
              stationShort={pass ? stationName(pass.noradId).short : ''}
              placeShort={place.name.split(',')[0] ?? place.name}
              stationName={(id) => stationName(id).short}
              onReady={() => setReady(true)}
              onFail={() => setFailed(true)}
            />
          </Suspense>
        )}

        <div className="flight-head">
          <div className="mx-auto max-w-[36rem] px-5 pt-[max(env(safe-area-inset-top),14px)]">
            {props.head}
            <p ref={clockRef} className="flight-clock serif tnum" aria-hidden="true" />
          </div>
        </div>

        <div className="flight-ground">
          <div className="mx-auto max-w-[36rem] px-5">{props.ground}</div>
        </div>

        <p ref={captionRef} className="flight-caption serif-i" data-on="0" />

        {capable && (
          <div
            ref={railRef}
            role="slider"
            tabIndex={0}
            aria-label={pass ? FLIGHT_COPY.rail : FLIGHT_COPY.railDusk}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={Math.round((tl.clock1 - tl.clock0) / 1000)}
            aria-valuenow={0}
            className="flight-rail"
            data-on="0"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              onRailPointer(e)
            }}
            onPointerMove={(e) => {
              if (e.buttons) onRailPointer(e)
            }}
            onKeyDown={onRailKey}
          >
            {ticks.map((t) => (
              <span key={t.f} className="flight-tick mono" style={{ top: `${t.f * 100}%` }}>
                {t.label}
              </span>
            ))}
            <span ref={thumbRef} className="flight-thumb" />
          </div>
        )}
      </div>
    </section>
  )
}

function azElOf(d: readonly [number, number, number]) {
  return {
    azDeg: ((Math.atan2(d[0], d[1]) * 180) / Math.PI + 360) % 360,
    elDeg: (Math.asin(Math.max(-1, Math.min(1, d[2]))) * 180) / Math.PI,
  }
}
