// Sky View: hold the phone up and see the sky in front of you, with the
// station's path drawn on it and an arrow guiding you to where it appears.
// Works three ways: motion sensors (+ optional camera backdrop), or
// drag-to-look on laptops and phones without a compass.
// Docs: docs/DESIGN.md#sky-view · Learn: docs/learn/11-compass.md
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { skyScene, type SkyScene } from '../engine/sky/scene.ts'
import { declinationDeg } from '../engine/magnetic/wmm.ts'
import { stationName, direction } from '../copy/en.ts'
import { formatTime, formatTimeSeconds } from '../lib/format.ts'
import { drawSky, interpolate } from '../sky/drawSky.ts'
import {
  basisLookingAt,
  enu,
  project,
  turnTo,
  type CameraBasis,
  type Viewport,
} from '../sky/projection.ts'
import { useOrientation } from '../sky/useOrientation.ts'
import { useCamera } from '../sky/useCamera.ts'
import { useStarCatalog } from '../sky/useStarCatalog.ts'

type Props = {
  pass: ForecastPass
  place: Place
  /** Sensors were granted in the click that opened us (iOS needs the gesture). */
  sensorsAllowed: boolean
  onClose: () => void
}

const ALIGNED_DEG = 8

export function SkyView({ pass, place, sensorsAllowed, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const catalog = useStarCatalog()
  const [decl] = useState(() => declinationDeg(place.latDeg, place.lonDeg, Date.now()))
  const sensors = useOrientation(sensorsAllowed, decl)
  const [cameraOn, setCameraOn] = useState(false)
  const { videoRef: cameraVideoRef, status: cameraStatus } = useCamera(cameraOn)
  const [red, setRed] = useState(() => document.documentElement.dataset.mode === 'night')
  const [calibrating, setCalibrating] = useState(false)
  const [vfov, setVfov] = useState(70)

  // Time: "live" follows the clock; scrubbing or the preview pins a simulated time.
  const [simMs, setSimMs] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  // Wall clock for the readout, ticked by the render loop once a second.
  const [clock, setClock] = useState(() => Date.now())

  // Drag-to-look camera for devices without sensors.
  const drag = useRef({ az: pass.start.azDeg, el: Math.max(15, Math.min(45, pass.peak.elDeg / 2)) })
  const dragStart = useRef<{ x: number; y: number; az: number; el: number } | null>(null)
  const useDrag = sensors.status !== 'active'

  const name = stationName(pass.noradId)
  const name1 = name.short
  const [guide, setGuide] = useState<{
    text: string
    sub: string
    aligned: boolean
    arrow: number | null
  }>({
    text: '',
    sub: '',
    aligned: false,
    arrow: null,
  })

  // Scene (stars, Moon, planets) recomputed at most once a second of sky time.
  const sceneRef = useRef<{ key: number; scene: SkyScene } | null>(null)
  const sceneAt = useCallback(
    (ms: number) => {
      const key = Math.floor(ms / 1000)
      if (
        !sceneRef.current ||
        sceneRef.current.key !== key ||
        (catalog && sceneRef.current.scene.stars.az.length === 0)
      ) {
        sceneRef.current = { key, scene: skyScene(place, ms, catalog) }
      }
      return sceneRef.current.scene
    },
    [place, catalog],
  )

  // Preview: play the pass at 8× from 30 s before it starts.
  useEffect(() => {
    if (!playing) return
    const t0 = performance.now()
    const from = pass.start.unixMs - 30_000
    const id = setInterval(() => {
      const t = from + (performance.now() - t0) * 8
      if (t > pass.end.unixMs + 20_000) {
        setPlaying(false)
        setSimMs(null)
      } else setSimMs(t)
    }, 33)
    return () => clearInterval(id)
  }, [playing, pass])

  // Render loop.
  useEffect(() => {
    let raf = 0
    let lastGuide = 0
    let lastClock = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const wall = Date.now()
      if (Math.floor(wall / 1000) !== Math.floor(lastClock / 1000)) {
        lastClock = wall
        setClock(wall)
      }
      const t = simMs ?? wall
      const station =
        t >= pass.start.unixMs && t <= pass.end.unixMs ? interpolate(pass.track, t) : null
      // Without a compass, the preview pans to follow the station.
      if (useDrag && simMs !== null && station && !dragStart.current) {
        let dAz = station.azDeg - drag.current.az
        if (dAz > 180) dAz -= 360
        if (dAz < -180) dAz += 360
        drag.current = {
          az: (drag.current.az + dAz * 0.08 + 360) % 360,
          el:
            drag.current.el + (Math.min(75, Math.max(12, station.elDeg)) - drag.current.el) * 0.08,
        }
      }
      const cam: CameraBasis =
        !useDrag && sensors.camRef.current
          ? sensors.camRef.current
          : basisLookingAt(drag.current.az, drag.current.el)
      const vp: Viewport = { width: w, height: h, vfovDeg: vfov, projection: 'rectilinear' }
      const scene = sceneAt(t)
      drawSky(ctx, {
        vp,
        cam,
        scene,
        catalog,
        opaque: !(cameraOn && cameraStatus === 'on'),
        red,
        track: pass.track,
        station,
        formatMinute: (ms) => formatTime(ms, place.timeZone).replace(/\s?[AP]M$/, ''),
        labels: true,
      })

      // Guidance, throttled to 5 Hz so text doesn't flicker.
      if (performance.now() - lastGuide > 200) {
        lastGuide = performance.now()
        const target = station ?? (t < pass.start.unixMs ? pass.start : pass.end)
        const tv = enu(target.azDeg, target.elDeg)
        const turn = turnTo(cam, tv)
        const onScreen = project(tv, cam, vp)
        const inView =
          onScreen &&
          onScreen.x > 30 &&
          onScreen.x < w - 30 &&
          onScreen.y > 90 &&
          onScreen.y < h - 140
        const aligned =
          Math.abs(turn.turnDeg) < ALIGNED_DEG && Math.abs(turn.tiltDeg) < ALIGNED_DEG + 4
        let text: string
        let sub: string
        if (station) {
          text = aligned || inView ? `There it is: follow the dot` : 'It’s up now: follow the arrow'
          sub = `${direction(station.azDeg)}, ${Math.round(station.elDeg)}° up · until ${formatTimeSeconds(pass.end.unixMs, place.timeZone)}`
        } else if (t < pass.start.unixMs) {
          const lr = turn.turnDeg > 0 ? 'right' : 'left'
          const ud = turn.tiltDeg > 0 ? 'up' : 'down'
          text = aligned
            ? `This is the spot. ${name1} appears here.`
            : Math.abs(turn.turnDeg) > ALIGNED_DEG
              ? `Turn ${lr} ${Math.round(Math.abs(turn.turnDeg))}°`
              : `Tilt ${ud} ${Math.round(Math.abs(turn.tiltDeg))}°`
          sub = `${direction(pass.start.azDeg)}, ${Math.round(pass.start.elDeg)}° up at ${formatTimeSeconds(pass.start.unixMs, place.timeZone)}`
        } else {
          text = `${name1} has passed`
          sub = `It faded out in the ${direction(pass.end.azDeg)}`
        }
        // Arrow (screen angle) when the target is off-screen.
        let arrow: number | null = null
        if (!inView) {
          if (onScreen) arrow = Math.atan2(onScreen.y - h / 2, onScreen.x - w / 2)
          else arrow = Math.atan2(-turn.tiltDeg, turn.turnDeg)
        }
        setGuide((g) =>
          g.text === text &&
          g.sub === sub &&
          g.aligned === aligned &&
          (g.arrow === null) === (arrow === null) &&
          (arrow === null || Math.abs((g.arrow ?? 0) - arrow) < 0.05)
            ? g
            : { text, sub, aligned, arrow },
        )
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [
    catalog,
    cameraOn,
    cameraStatus,
    red,
    pass,
    place,
    sceneAt,
    sensors.camRef,
    simMs,
    useDrag,
    vfov,
    name1,
  ])

  // A short buzz when you line up with the starting point (Android; iOS ignores it).
  const buzzed = useRef(false)
  useEffect(() => {
    if (guide.aligned && !buzzed.current) {
      buzzed.current = true
      navigator.vibrate?.(30)
    }
    if (!guide.aligned) buzzed.current = false
  }, [guide.aligned])

  // Escape closes; lock page scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // What to line up for compass calibration: the Moon, else the brightest planet.
  const clockMinute = Math.floor(clock / 60_000)
  const calibrationTarget = useMemo(() => {
    const s = skyScene(place, clockMinute * 60_000, null)
    if (s.moon.elDeg > 5) return { name: 'the Moon', azDeg: s.moon.azDeg, elDeg: s.moon.elDeg }
    const planet = s.planets
      .filter((p) => p.elDeg > 10 && p.magnitude < 0)
      .sort((x, y) => x.magnitude - y.magnitude)[0]
    return planet
      ? {
          name: planet.id.charAt(0).toUpperCase() + planet.id.slice(1),
          azDeg: planet.azDeg,
          elDeg: planet.elDeg,
        }
      : null
  }, [place, clockMinute])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sky View: finding ${name.short}`}
      className="fixed inset-0 z-50 bg-black text-ink select-none"
    >
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          if (!useDrag) return
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            az: drag.current.az,
            el: drag.current.el,
          }
        }}
        onPointerMove={(e) => {
          const d = dragStart.current
          if (!d || !wrapRef.current) return
          const degPerPx = vfov / wrapRef.current.clientHeight
          drag.current = {
            az: (d.az - (e.clientX - d.x) * degPerPx + 360) % 360,
            el: Math.max(-10, Math.min(89, d.el + (e.clientY - d.y) * degPerPx)),
          }
        }}
        onPointerUp={() => (dragStart.current = null)}
        onWheel={(e) => setVfov((f) => Math.max(30, Math.min(100, f + e.deltaY * 0.05)))}
      >
        {cameraOn && (
          <video
            ref={cameraVideoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Centre reticle */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${guide.aligned ? 'border-station' : 'border-white/35'}`}
        />
        {guide.arrow !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{
              transform: `translate(-50%,-50%) rotate(${guide.arrow}rad) translateX(min(34vw, 34vh))`,
            }}
          >
            <svg width="44" height="44" viewBox="-22 -22 44 44">
              <path d="M 14 0 L -8 -11 L -3 0 L -8 11 Z" fill="var(--station)" />
            </svg>
          </div>
        )}
      </div>

      {/* Top: guidance */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-5 pt-[max(env(safe-area-inset-top),14px)] pb-10">
        <div className="pointer-events-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-black/40 px-3 py-1.5 text-sm font-medium"
          >
            Done
          </button>
          <div className="flex gap-2 text-sm">
            {sensors.status === 'active' && (
              <button
                type="button"
                aria-pressed={cameraOn}
                onClick={() => setCameraOn((v) => !v)}
                className={`rounded-md px-3 py-1.5 ${cameraOn ? 'bg-white/20' : 'bg-black/40'}`}
              >
                Camera
              </button>
            )}
            <button
              type="button"
              aria-pressed={red}
              onClick={() => setRed((v) => !v)}
              className={`rounded-md px-3 py-1.5 ${red ? 'bg-white/20' : 'bg-black/40'}`}
            >
              Red light
            </button>
          </div>
        </div>
        <p
          aria-live="polite"
          className={`mt-4 text-2xl leading-tight font-semibold ${guide.aligned ? 'text-station' : ''}`}
        >
          {guide.text}
        </p>
        <p className="tnum mt-1 text-sm text-white/70">{guide.sub}</p>
        {useDrag && (
          <p className="mt-1 text-xs text-white/55">
            {sensors.status === 'unavailable' || sensors.status === 'idle'
              ? 'No compass on this device: drag to look around.'
              : 'Motion access is off: drag to look around.'}
          </p>
        )}
        {cameraOn && cameraStatus === 'blocked' && (
          <p className="mt-1 text-xs text-white/70">
            Camera unavailable here. The drawn sky still lines up with the real one.
          </p>
        )}
      </div>

      {/* Bottom: time and tools */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pt-12 pb-[max(env(safe-area-inset-bottom),16px)]">
        {calibrating && calibrationTarget ? (
          <div className="rounded-lg bg-black/60 p-4">
            <p className="font-semibold">Line up {calibrationTarget.name} in the circle</p>
            <p className="mt-1 text-sm text-white/70">
              Phone compasses drift near cars and metal. This fixes it for this session.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="rounded-md bg-station px-4 py-2 font-semibold text-black"
                onClick={() => {
                  sensors.calibrateTo(calibrationTarget.azDeg)
                  setCalibrating(false)
                }}
              >
                It’s centred
              </button>
              <button
                type="button"
                className="rounded-md bg-white/10 px-4 py-2"
                onClick={() => setCalibrating(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="tnum text-sm text-white/80">
                {simMs === null ? 'Live' : 'Preview'} ·{' '}
                {formatTimeSeconds(simMs ?? clock, place.timeZone)}
              </p>
              <div className="flex gap-2 text-sm">
                {sensors.status === 'active' && calibrationTarget && (
                  <button
                    type="button"
                    onClick={() => setCalibrating(true)}
                    className="rounded-md bg-black/40 px-3 py-1.5"
                  >
                    Fix compass
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (playing || simMs !== null) {
                      setPlaying(false)
                      setSimMs(null)
                    } else setPlaying(true)
                  }}
                  className="rounded-md bg-station px-3 py-1.5 font-semibold text-black"
                >
                  {playing || simMs !== null ? 'Back to live' : 'Preview the pass'}
                </button>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Scrub through the pass</span>
              <input
                type="range"
                min={pass.start.unixMs - 60_000}
                max={pass.end.unixMs + 30_000}
                step={1000}
                value={Math.min(
                  Math.max(simMs ?? clock, pass.start.unixMs - 60_000),
                  pass.end.unixMs + 30_000,
                )}
                onChange={(e) => {
                  setPlaying(false)
                  setSimMs(Number(e.target.value))
                }}
                className="w-full accent-[var(--station)]"
              />
            </label>
            <p className="tnum mt-1 flex justify-between text-xs text-white/60">
              <span>{formatTime(pass.start.unixMs, place.timeZone)} rises</span>
              <span>{formatTime(pass.end.unixMs, place.timeZone)} gone</span>
            </p>
            {cameraOn && (
              <label className="mt-2 flex items-center gap-3 text-xs text-white/70">
                Match camera zoom
                <input
                  type="range"
                  min={45}
                  max={90}
                  value={vfov}
                  onChange={(e) => setVfov(Number(e.target.value))}
                  className="flex-1 accent-[var(--station)]"
                />
              </label>
            )}
            <p className="mt-2 text-[11px] text-white/45">
              North corrected for {Math.abs(decl).toFixed(1)}° {decl >= 0 ? 'east' : 'west'}{' '}
              magnetic declination (NOAA WMM2025).
              {sensors.accuracyDeg !== null &&
                ` Compass accuracy ±${Math.round(sensors.accuracyDeg)}°.`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
