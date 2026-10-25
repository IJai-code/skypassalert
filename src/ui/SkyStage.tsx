// The whole screen is the sky. Three modes, switched like a camera app:
//   SKY     the sky at tonight's pass time, drag to look around
//   FIND IT live: hold the phone up, an arrow walks you to the spot
//   CAMERA  Sky Camera: lock onto the Moon, a planet, a star or a station,
//           sync the compass from the image, shoot a burst, stack it
// Docs: docs/DESIGN.md · Learn: docs/learn/11-compass.md, 12-sky-camera.md
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ForecastPass } from '../engine/index.ts'
import type { Place } from '../engine/place.ts'
import { skyScene, type SkyScene } from '../engine/sky/scene.ts'
import type { StarCatalog } from '../engine/stars/stars.ts'
import { declinationDeg } from '../engine/magnetic/wmm.ts'
import { direction, stationName } from '../copy/en.ts'
import { formatTime, formatTimeSeconds } from '../lib/format.ts'
import { drawSky, interpolate } from '../sky/drawSky.ts'
import {
  azEl,
  basisLookingAt,
  enu,
  project,
  turnTo,
  type CameraBasis,
  type Viewport,
} from '../sky/projection.ts'
import { requestMotionPermission, useOrientation } from '../sky/useOrientation.ts'
import { smoothBasis } from '../sky/orientation.ts'
import { useCamera } from '../sky/useCamera.ts'
import { HeadingTape } from './hud/HeadingTape.tsx'
import { RECIPES, targetsFor, type Target } from '../photo/targets.ts'
import { applyPreset, resetPreset, type Applied } from '../photo/cameraControl.ts'
import { measureSync } from '../photo/sync.ts'
import type { ShotKind } from '../photo/stack.ts'
import type { StackRequest, StackResponse } from '../photo/stack.worker.ts'
import { CaptureResult, type Capture } from './CaptureResult.tsx'
import { postcardView } from './stageView.ts'

export type StageMode = 'sky' | 'find' | 'camera'

type Props = {
  place: Place
  passes: readonly ForecastPass[]
  /** The pass the screen is about (tonight's best or the one picked from the list). */
  focus: ForecastPass | null
  catalog: StarCatalog | null
  red: boolean
  /** Pixels at the bottom covered by the tab bar. */
  bottomInset: number
  mode: StageMode
  /** Camera tab: start aimed at this target (e.g. "moon" from the Tonight screen). */
  initialTargetId?: string | null
}

const ALIGNED = 8
const touchDevice = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0

export function SkyStage({
  place,
  passes,
  focus,
  catalog,
  red,
  bottomInset,
  mode,
  initialTargetId = null,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const live = mode !== 'sky'
  const [decl] = useState(() => declinationDeg(place.latDeg, place.lonDeg, Date.now()))
  // Every route into a live mode asks for motion permission in its own tap first.
  const sensors = useOrientation(live, decl)
  const {
    videoRef: camVideoRef,
    trackRef: camTrackRef,
    status: camStatus,
  } = useCamera(mode === 'camera')
  const useDrag = !live || sensors.status !== 'active'

  // Drag camera: starts facing where tonight's pass begins.
  const drag = useRef({ az: 0, el: 30 })
  const dragStart = useRef<{ x: number; y: number; az: number; el: number } | null>(null)
  const focusKey = focus ? `${focus.noradId}-${focus.start.unixMs}` : 'none'
  useEffect(() => {
    drag.current = focus ? { az: postcardView(focus).az, el: 28 } : { az: 180, el: 35 }
  }, [focusKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [vfovLive, setVfovLive] = useState(66)
  const [simMs, setSimMs] = useState<number | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [hud, setHud] = useState({ heading: 0, el: 0, day: false })
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
  const [pickedTarget, setTarget] = useState<Target | null>(null)
  const [sync, setSync] = useState<{ name: string; at: number } | null>(null)
  const [applied, setApplied] = useState<Applied | null>(null)
  const [capturing, setCapturing] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<Capture | null>(null)
  const [showRecipe, setShowRecipe] = useState(false)

  // Time shown: SKY mode previews the focused pass at its peak; live modes use now.
  const skyTime = !live && focus ? focus.peak.unixMs : null

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

  const clockMinute = Math.floor(clock / 60_000)
  const targets = useMemo(
    () =>
      targetsFor(
        skyScene(place, clockMinute * 60_000, catalog),
        catalog,
        passes,
        clockMinute * 60_000,
      ),
    [place, catalog, passes, clockMinute],
  )
  // Until you pick one: the target asked for, else the brightest non-station object.
  const target =
    pickedTarget ??
    targets.find((t) => t.id === initialTargetId) ??
    targets.find((t) => t.kind !== 'trail') ??
    targets[0] ??
    null

  // Mode switch: iOS grants motion access only inside the tap.
  const switchMode = async (m: StageMode) => {
    if (m !== 'sky' && !live) {
      const ok = await requestMotionPermission()
      if (!ok) sensors.setStatus('denied')
    }
    if (m === 'camera' && !target)
      setTarget(targets.find((t) => t.kind !== 'trail') ?? targets[0] ?? null)
    if (m !== 'camera') {
      setApplied(null)
      void resetPreset(camTrackRef.current)
    }
    setSimMs(null)
    void m
  }

  // Apply camera settings for the chosen target.
  useEffect(() => {
    if (mode !== 'camera' || camStatus !== 'on' || !target) return
    let alive = true
    void applyPreset(camTrackRef.current, target.kind).then((a) => alive && setApplied(a))
    return () => {
      alive = false
    }
  }, [mode, camStatus, camTrackRef, target])

  // Live view geometry, shared by the render loop, sync and capture.
  const viewRef = useRef<{ cam: CameraBasis; vp: Viewport } | null>(null)

  // Render loop.
  useEffect(() => {
    let raf = 0
    let lastGuide = 0
    let lastClock = 0
    let lastStatic = ''
    let lastFrame = 0
    let shown: CameraBasis | null = null
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      // Live views redraw every frame: cap the pixel ratio to keep phones smooth.
      const dpr = Math.min(window.devicePixelRatio || 1, live ? 1.5 : 2)
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
      const t = simMs ?? skyTime ?? wall
      const station =
        focus && t >= focus.start.unixMs && t <= focus.end.unixMs
          ? interpolate(focus.track, t)
          : null
      if (live && useDrag && simMs !== null && station && !dragStart.current) {
        let d = station.azDeg - drag.current.az
        if (d > 180) d -= 360
        if (d < -180) d += 360
        drag.current = {
          az: (drag.current.az + d * 0.08 + 360) % 360,
          el:
            drag.current.el + (Math.min(75, Math.max(12, station.elDeg)) - drag.current.el) * 0.08,
        }
      }
      // Sensor view: ease towards the latest reading every frame (time-based, so
      // it's equally smooth at 60 or 120 Hz and never lags more than ~0.1 s).
      let cam: CameraBasis
      const raw = !useDrag ? sensors.camRef.current : null
      if (raw) {
        const nowT = performance.now()
        const dt = lastFrame ? Math.min(100, nowT - lastFrame) : 16
        lastFrame = nowT
        shown = smoothBasis(shown, raw, 1 - Math.exp(-dt / 70))
        cam = shown
      } else {
        shown = null
        cam = basisLookingAt(drag.current.az, drag.current.el)
      }
      // SKY mode: a wide, undistorted view with the horizon above the info sheet.
      const visibleH = Math.max(200, h - bottomInset)
      const vp: Viewport = live
        ? { width: w, height: h, vfovDeg: vfovLive, projection: 'rectilinear' }
        : {
            width: w,
            height: h,
            vfovDeg: Math.max(80, Math.min(120, (110 * h) / Math.max(w, 1))),
            projection: 'stereographic',
            cy: visibleH * 0.42,
          }
      viewRef.current = { cam, vp }
      // SKY mode is a still picture: only redraw when something visible changed.
      if (!live) {
        const sig = `${w}x${h}|${drag.current.az.toFixed(2)},${drag.current.el.toFixed(2)}|${catalog ? 1 : 0}|${Math.floor(wall / 60_000)}`
        if (sig === lastStatic) return
        lastStatic = sig
      }
      const scene = sceneAt(t)
      drawSky(ctx, {
        vp,
        cam,
        scene,
        catalog,
        opaque: !(mode === 'camera' && camStatus === 'on'),
        red,
        track: mode === 'camera' ? (target?.pass?.track ?? null) : (focus?.track ?? null),
        station,
        formatMinute: (ms) => formatTime(ms, place.timeZone).replace(/\s?[AP]M$/, ''),
        labels: true,
        style: mode === 'camera' && camStatus === 'on' ? 'clean' : 'full',
        alwaysNight: live,
        highlight:
          mode === 'camera' && target
            ? { azDeg: target.azDeg, elDeg: target.elDeg, label: target.name }
            : null,
      })

      if (performance.now() - lastGuide > 200) {
        lastGuide = performance.now()
        const f = azEl(cam.forward)
        const day = scene.sun.elDeg > -6
        setHud((hh) =>
          Math.abs(hh.heading - f.azDeg) < 0.3 && Math.abs(hh.el - f.elDeg) < 0.3 && hh.day === day
            ? hh
            : { heading: f.azDeg, el: f.elDeg, day },
        )
        if (!live) return
        const tgt =
          mode === 'camera' && target
            ? { azDeg: target.azDeg, elDeg: target.elDeg }
            : (station ?? (focus ? (t < focus.start.unixMs ? focus.start : focus.end) : null))
        if (!tgt) return
        const tv = enu(tgt.azDeg, tgt.elDeg)
        const turn = turnTo(cam, tv)
        const on = project(tv, cam, vp)
        const inView = on && on.x > 30 && on.x < w - 30 && on.y > 140 && on.y < h - 200
        const aligned = Math.abs(turn.turnDeg) < ALIGNED && Math.abs(turn.tiltDeg) < ALIGNED + 4
        const name =
          mode === 'camera' && target ? target.name : focus ? stationName(focus.noradId).short : ''
        let text: string
        let sub: string
        if (mode === 'find' && station) {
          text = inView ? 'There it is: follow the dot' : 'It’s up now: follow the arrow'
          sub = `${direction(station.azDeg)}, ${Math.round(station.elDeg)}° up`
        } else if (mode === 'find' && focus && t > focus.end.unixMs) {
          text = `${name} has passed`
          sub = 'Pick another night from the list'
        } else {
          const lr = turn.turnDeg > 0 ? 'right' : 'left'
          const ud = turn.tiltDeg > 0 ? 'up' : 'down'
          text = aligned
            ? mode === 'camera'
              ? `${name} is in the frame`
              : `This is the spot. ${name} appears here.`
            : Math.abs(turn.turnDeg) > ALIGNED
              ? `Turn ${lr} ${Math.round(Math.abs(turn.turnDeg))}°`
              : `Tilt ${ud} ${Math.round(Math.abs(turn.tiltDeg))}°`
          sub =
            mode === 'camera' && target
              ? `${target.name} · ${direction(target.azDeg)}, ${Math.round(target.elDeg)}° up`
              : focus
                ? `${direction(focus.start.azDeg)}, ${Math.round(focus.start.elDeg)}° up at ${formatTimeSeconds(focus.start.unixMs, place.timeZone)}`
                : ''
        }
        let arrow: number | null = null
        if (!inView)
          arrow = on
            ? Math.atan2(on.y - h / 2, on.x - w / 2)
            : Math.atan2(-turn.tiltDeg, turn.turnDeg)
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
    camStatus,
    red,
    focus,
    place,
    sceneAt,
    sensors.camRef,
    simMs,
    skyTime,
    useDrag,
    vfovLive,
    live,
    mode,
    target,
    bottomInset,
  ])

  // Buzz when lined up (Android).
  const buzzed = useRef(false)
  useEffect(() => {
    if (guide.aligned && !buzzed.current) {
      buzzed.current = true
      navigator.vibrate?.(30)
    }
    if (!guide.aligned) buzzed.current = false
  }, [guide.aligned])

  // Sky Sync: twice a second, find bright objects in the camera image and correct the compass.
  useEffect(() => {
    if (mode !== 'camera' || camStatus !== 'on' || sensors.status !== 'active') return
    const small = document.createElement('canvas')
    const id = setInterval(() => {
      const video = camVideoRef.current
      const view = viewRef.current
      const wrap = wrapRef.current
      if (!video || !view || !wrap || !video.videoWidth) return
      const sw = 192
      const sh = Math.round((sw * video.videoHeight) / video.videoWidth)
      small.width = sw
      small.height = sh
      const sctx = small.getContext('2d', { willReadFrequently: true })
      if (!sctx) return
      sctx.drawImage(video, 0, 0, sw, sh)
      const img = sctx.getImageData(0, 0, sw, sh)
      // object-fit: cover mapping from video pixels to screen pixels.
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight)
      const ox = (W - video.videoWidth * scale) / 2
      const oy = (H - video.videoHeight * scale) / 2
      const k = video.videoWidth / sw
      const match = measureSync(
        img.data,
        sw,
        sh,
        (x, y) => ({ x: ox + x * k * scale, y: oy + y * k * scale }),
        view.cam,
        view.vp,
        sceneAt(Date.now()),
        catalog,
      )
      if (match && Math.abs(match.yawErrorDeg) < 25) {
        sensors.nudgeYaw(match.yawErrorDeg * 0.5)
        if (Math.abs(match.yawErrorDeg) < 2.5) setSync({ name: match.name, at: Date.now() })
      }
    }, 500)
    return () => clearInterval(id)
  }, [mode, camStatus, camVideoRef, sensors, sceneAt, catalog])
  const synced = sync && clock - sync.at < 4000

  // ── Capture ─────────────────────────────────────────────────────────────
  const workerRef = useRef<Worker | null>(null)
  const runStack = (req: StackRequest, transfer: ArrayBuffer[]) =>
    new Promise<StackResponse>((resolve) => {
      if (!workerRef.current)
        workerRef.current = new Worker(new URL('../photo/stack.worker.ts', import.meta.url), {
          type: 'module',
        })
      workerRef.current.onmessage = (e: MessageEvent<StackResponse>) => resolve(e.data)
      workerRef.current.postMessage(req, transfer)
    })
  useEffect(() => () => workerRef.current?.terminate(), [])

  const caption = (kind: ShotKind) => {
    const when = new Date().toLocaleString('en-US', {
      timeZone: place.timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    const name = target?.name ?? RECIPES[kind].title
    const detail = target?.kind === 'moon' ? ` · ${target.detail}` : ''
    return `${name}${detail} · ${when} · ${place.name}`
  }

  const finish = async (
    kind: ShotKind,
    frames: Array<{ buffer: ArrayBuffer; width: number; height: number }>,
    info: string,
  ) => {
    const res = await runStack(
      { kind, frames },
      frames.map((f) => f.buffer),
    )
    if (!res.ok) {
      setCapturing(null)
      return
    }
    const toUrl = async (buf: ArrayBuffer) => {
      const c = document.createElement('canvas')
      c.width = res.width
      c.height = res.height
      c.getContext('2d')?.putImageData(
        new ImageData(new Uint8ClampedArray(buf), res.width, res.height),
        0,
        0,
      )
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92))
      return blob ? URL.createObjectURL(blob) : ''
    }
    setResult({
      after: await toUrl(res.after),
      before: await toUrl(res.before),
      width: res.width,
      height: res.height,
      caption: caption(kind),
      info: `${info} · stacked ${res.used} of ${frames.length} frames`,
      kind,
    })
    setCapturing(null)
  }

  const shoot = async () => {
    const video = camVideoRef.current
    const wrap = wrapRef.current
    if (!video || !wrap || !video.videoWidth || capturing) return
    const kind: ShotKind = target?.kind ?? 'stars'
    const vw = video.videoWidth
    const vh = video.videoHeight
    // Crop around the target for Moon/planet; whole frame (scaled) otherwise.
    let crop = { x: 0, y: 0, w: vw, h: vh }
    let outW = Math.min(1280, vw)
    if ((kind === 'moon' || kind === 'planet') && target && viewRef.current) {
      const p = project(enu(target.azDeg, target.elDeg), viewRef.current.cam, viewRef.current.vp)
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      const scale = Math.max(W / vw, H / vh)
      const cx = p ? (p.x - (W - vw * scale) / 2) / scale : vw / 2
      const cy = p ? (p.y - (H - vh * scale) / 2) / scale : vh / 2
      const size = Math.min(vw, vh, kind === 'moon' ? 900 : 600)
      crop = {
        x: Math.round(Math.min(vw - size, Math.max(0, cx - size / 2))),
        y: Math.round(Math.min(vh - size, Math.max(0, cy - size / 2))),
        w: size,
        h: size,
      }
      outW = size
    }
    const outH = Math.round((outW * crop.h) / crop.w)
    const total = kind === 'trail' ? 80 : kind === 'stars' ? 16 : 24
    const c = document.createElement('canvas')
    c.width = outW
    c.height = outH
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    setCapturing({ done: 0, total })
    const frames: Array<{ buffer: ArrayBuffer; width: number; height: number }> = []
    let trail: Uint8ClampedArray | null = null
    const grab = () => {
      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)
      const d = ctx.getImageData(0, 0, outW, outH).data
      if (kind === 'trail') {
        // Lighten on the fly: one buffer, however long the trail.
        if (!trail) trail = new Uint8ClampedArray(d)
        else {
          const tr = trail
          for (let i = 0; i < d.length; i++) if ((d[i] ?? 0) > (tr[i] ?? 0)) tr[i] = d[i] ?? 0
        }
      } else frames.push({ buffer: d.buffer as ArrayBuffer, width: outW, height: outH })
    }
    for (let i = 0; i < total; i++) {
      grab()
      setCapturing({ done: i + 1, total })
      await new Promise((r) => setTimeout(r, kind === 'trail' ? 120 : 70))
    }
    const info = applied?.label ?? 'Automatic exposure'
    if (kind === 'trail' && trail) {
      const t = trail as Uint8ClampedArray
      await finish(kind, [{ buffer: t.buffer as ArrayBuffer, width: outW, height: outH }], info)
    } else await finish(kind, frames, info)
  }

  // The phone's own camera (best single shots on iPhone), then we enhance + label.
  const fileRef = useRef<HTMLInputElement>(null)
  const onNativePhoto = async (file: File) => {
    const kind: ShotKind = target?.kind ?? 'moon'
    setCapturing({ done: 0, total: 1 })
    const bmp = await createImageBitmap(file)
    const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    await finish(
      kind,
      [{ buffer: d.buffer as ArrayBuffer, width: c.width, height: c.height }],
      'Your camera’s photo, enhanced',
    )
  }

  // Esc leaves live modes.
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && void switchMode('sky')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const recipe = target ? RECIPES[target.kind] : null

  return (
    <div className="fixed inset-0 bg-black text-white select-none">
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
          const wrap = wrapRef.current
          if (!d || !wrap) return
          const degPerPx = (live ? vfovLive : 100) / wrap.clientHeight
          drag.current = {
            az: (d.az - (e.clientX - d.x) * degPerPx + 360) % 360,
            el: Math.max(-5, Math.min(85, d.el + (e.clientY - d.y) * degPerPx)),
          }
        }}
        onPointerUp={() => (dragStart.current = null)}
        onWheel={(e) =>
          live && setVfovLive((f) => Math.max(25, Math.min(100, f + e.deltaY * 0.05)))
        }
      >
        {mode === 'camera' && (
          <video
            ref={camVideoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            focus
              ? `Sky view facing ${direction(hud.heading)}, with the path of ${stationName(focus.noradId).short} drawn on it.`
              : `Sky view facing ${direction(hud.heading)}.`
          }
          className="absolute inset-0 h-full w-full"
        />

        {live && (
          <>
            {/* Viewfinder brackets */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 transition-colors ${guide.aligned ? 'text-action' : 'text-white/60'}`}
            >
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((c) => (
                <span key={c} className={`absolute size-4 border-current ${c}`} />
              ))}
            </div>
            {guide.arrow !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2"
                style={{
                  transform: `translate(-50%,-50%) rotate(${guide.arrow}rad) translateX(min(34vw, 30vh))`,
                }}
              >
                <svg width="46" height="46" viewBox="-23 -23 46 46">
                  <path d="M 15 0 L -9 -12 L -3 0 L -9 12 Z" fill="var(--action)" />
                </svg>
              </div>
            )}
          </>
        )}
      </div>

      {/* Top: heading tape and one clear instruction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 via-black/25 to-transparent pt-[max(env(safe-area-inset-top),12px)] pb-8">
        <div className="mx-auto max-w-xl px-4">
          <HeadingTape
            headingDeg={hud.heading}
            elDeg={hud.el}
            targetAzDeg={
              mode === 'camera' && target ? target.azDeg : focus ? focus.start.azDeg : null
            }
          />
        </div>
        {live && (
          <div className="mx-auto mt-4 flex max-w-xl flex-col items-center px-5 text-center">
            <p
              aria-live="polite"
              className={`display rounded-full px-4 py-2 text-[1.0625rem] backdrop-blur-md ${guide.aligned ? 'bg-action text-action-ink' : 'bg-black/45 text-white'}`}
            >
              {guide.text}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-white/75">{guide.sub}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {mode === 'camera' && synced && sync && (
                <span className="display rounded-full bg-action/90 px-3 py-1 text-[0.75rem] text-action-ink">
                  Synced to {sync.name}
                </span>
              )}
              {mode === 'camera' &&
                !synced &&
                sensors.status === 'active' &&
                camStatus === 'on' && (
                  <span className="rounded-full bg-black/45 px-3 py-1 text-[0.75rem] text-white/75 backdrop-blur-md">
                    Aim at the Moon or a bright planet to sync
                  </span>
                )}
              {useDrag && touchDevice && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await requestMotionPermission()) sensors.restart()
                    else sensors.setStatus('denied')
                  }}
                  className="pointer-events-auto display rounded-full bg-action px-4 py-1.5 text-[0.8125rem] text-action-ink"
                >
                  Point with your phone
                </button>
              )}
              {useDrag && (
                <span className="rounded-full bg-black/45 px-3 py-1 text-[0.75rem] text-white/70 backdrop-blur-md">
                  {sensors.status === 'denied'
                    ? 'Motion access is off. Drag to look around'
                    : touchDevice
                      ? 'Or drag to look around'
                      : 'Drag to look around'}
                </span>
              )}
              {!useDrag && (
                <span className="rounded-full bg-black/45 px-3 py-1 text-[0.75rem] text-white/75 backdrop-blur-md">
                  Live · following your phone
                </span>
              )}
              {hud.day && (
                <span className="rounded-full bg-black/45 px-3 py-1 text-[0.75rem] text-white/75 backdrop-blur-md">
                  Daytime: showing what’s behind the blue sky
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="absolute inset-x-0 flex flex-col items-center gap-3 px-4"
        style={{ bottom: bottomInset + 12 }}
      >
        {mode === 'camera' && (
          <>
            {recipe && (
              <div className="w-full max-w-md rounded-2xl bg-black/50 px-4 py-2.5 text-sm ring-1 ring-white/10 backdrop-blur-md">
                <button
                  type="button"
                  aria-expanded={showRecipe}
                  onClick={() => setShowRecipe((v) => !v)}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                  <span className="display text-[0.875rem] text-action">{recipe.title} tips</span>
                  <span className="hud text-[13px] text-white/75">
                    {applied ? applied.label.split(' (')[0] : 'Auto'}
                  </span>
                  <span className="text-[0.75rem] font-semibold text-white/60">
                    {showRecipe ? 'Less' : 'More'}
                  </span>
                </button>
                {showRecipe && (
                  <div className="mt-1.5 space-y-1.5">
                    <p className="text-white/90">{recipe.tip}</p>
                    <p className="text-white/60">{recipe.expect}</p>
                    {applied && !applied.manual && (
                      <p className="text-white/60">{applied.label}.</p>
                    )}
                    <p className="text-white/60">
                      <span className="text-white/85">
                        Best single shot with your phone’s own camera:{' '}
                      </span>
                      {recipe.native}
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Targets */}
            <div className="flex w-full max-w-xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={target?.id === t.id}
                  onClick={() => setTarget(t)}
                  className={`shrink-0 rounded-2xl px-3.5 py-2 text-left ring-1 backdrop-blur-md ${target?.id === t.id ? 'bg-action text-action-ink ring-action' : 'bg-black/45 text-white ring-white/15'}`}
                >
                  <span className="display block text-[0.9375rem]">{t.name}</span>
                  <span
                    className={`block text-[0.6875rem] ${target?.id === t.id ? 'text-action-ink/75' : 'text-white/60'}`}
                  >
                    {t.detail}
                  </span>
                </button>
              ))}
              {!targets.length && (
                <p className="text-sm text-white/70">Nothing bright is up right now.</p>
              )}
            </div>
            {/* Shutter row */}
            <div className="flex w-full max-w-md items-center justify-between">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 rounded-full bg-black/45 px-3 py-2 text-center text-[0.75rem] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md"
              >
                Phone camera
              </button>
              <button
                type="button"
                onClick={() => void shoot()}
                disabled={camStatus !== 'on' || !!capturing}
                aria-label={
                  capturing
                    ? `Capturing frame ${capturing.done} of ${capturing.total}`
                    : 'Take a stacked photo'
                }
                className="relative grid size-[74px] place-items-center rounded-full border-4 border-white/90 disabled:opacity-50"
              >
                <span
                  className={`block rounded-full bg-white transition-all ${capturing ? 'size-7 rounded-md bg-station' : 'size-[58px]'}`}
                />
                {capturing && (
                  <svg
                    className="absolute inset-[-4px] -rotate-90"
                    viewBox="0 0 80 80"
                    aria-hidden="true"
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="37"
                      fill="none"
                      stroke="var(--station)"
                      strokeWidth="4"
                      strokeDasharray={`${(capturing.done / capturing.total) * 232} 232`}
                    />
                  </svg>
                )}
              </button>
              <label className="flex w-24 flex-col items-end text-[0.75rem] font-semibold text-white/80">
                Zoom
                <input
                  type="range"
                  min={25}
                  max={90}
                  value={vfovLive}
                  onChange={(e) => setVfovLive(Number(e.target.value))}
                  className="mt-1 w-20 accent-[var(--action)]"
                  aria-label="Match the drawn sky to the camera’s zoom"
                />
              </label>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onNativePhoto(f)
                e.target.value = ''
              }}
            />
            {camStatus === 'blocked' && (
              <p className="text-sm text-white/80">
                Camera unavailable here. Use “Phone camera” instead.
              </p>
            )}
          </>
        )}

        {mode === 'find' && focus && (
          <div className="glass flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3">
            <p className="hud text-[15px] text-white/85">
              {simMs === null ? 'Live' : 'Preview'} ·{' '}
              {formatTimeSeconds(simMs ?? clock, place.timeZone)}
            </p>
            <button
              type="button"
              onClick={() => {
                if (simMs !== null) return setSimMs(null)
                const from = focus.start.unixMs - 20_000
                const t0 = performance.now()
                const id = setInterval(() => {
                  const t = from + (performance.now() - t0) * 8
                  if (t > focus.end.unixMs + 15_000) {
                    clearInterval(id)
                    setSimMs(null)
                  } else setSimMs(t)
                }, 33)
              }}
              className="hud-caps rounded-md bg-station px-3 py-2 text-black"
            >
              {simMs === null ? 'Preview the pass' : 'Back to live'}
            </button>
          </div>
        )}
      </div>

      {result && <CaptureResult capture={result} onClose={() => setResult(null)} />}
    </div>
  )
}
