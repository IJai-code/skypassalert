// The Flight's camera: where it stands, where it looks, and how it gets from
// your yard to orbit. Also the CPU twin of the GPU's projection, so the text
// labels (compass points, minute times, "You") sit exactly on the picture.
// Learn: docs/learn/16-the-flight.md#camera
import type { ForecastPass } from '../../engine/index.ts'
import { interpolate } from '../../sky/drawSky.ts'
import { postcardView } from '../stageView.ts'
import { enu } from '../../sky/projection.ts'
import type { World } from './world.ts'
import { EYE_KM } from './world.ts'
import {
  add,
  cross,
  dot,
  lerpAngleDeg,
  scale,
  slerp,
  smoothstep,
  sub,
  unit,
  type V3,
} from './vec.ts'

const D = Math.PI / 180

export type Cam = {
  eye: V3
  /** Height of the eye above the sphere, km (kept separately for precision). */
  eyeAlt: number
  right: V3
  up: V3
  forward: V3
  vfovDeg: number
}
export type Screen = { width: number; height: number }

/** Right/up from a forward direction and a rough "up". */
export function orient(forward: V3, upHint: V3): Pick<Cam, 'right' | 'up' | 'forward'> {
  const f = unit(forward)
  let r = cross(f, upHint)
  if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = cross(f, [0, 1, 0])
  const right = unit(r)
  return { right, up: cross(right, f), forward: f }
}

/** Phones (portrait) get a tall view; wide screens a calmer one. */
export function vfovFor(s: Screen): number {
  return s.height >= s.width ? 74 : 54
}

/**
 * Where the horizon sits, as a fraction of the screen height from the top.
 * The answer is set on the ground below it, so short phones lift it to make
 * room. These thresholds match the `.flight-ground` rules in index.css.
 */
export function horizonFrac(s: Screen): number {
  const tall = s.height / s.width
  if (tall >= 2) return 0.56
  if (tall >= 1.5) return 0.5
  return 0.6
}

/** The pitch that puts the horizon at `frac` of the screen height (0 = top). */
export function horizonPitchDeg(vfovDeg: number, frac = 0.58): number {
  return Math.atan((2 * frac - 1) * Math.tan((vfovDeg / 2) * D)) / D
}

type Projected = { x: number; y: number; depth: number }

function toScreen(cam: Cam, s: Screen, v: V3): Projected | null {
  const x = dot(v, cam.right)
  const y = dot(v, cam.up)
  const z = dot(v, cam.forward)
  if (z <= 1e-9) return null
  const f = 1 / Math.tan((cam.vfovDeg / 2) * D)
  const aspect = s.width / s.height
  return {
    x: ((1 + (x / z) * (f / aspect)) / 2) * s.width,
    y: ((1 - (y / z) * f) / 2) * s.height,
    depth: z,
  }
}

/** Screen position of a point in the world (km), or null behind the camera. */
export const projectPoint = (cam: Cam, s: Screen, p: V3) => toScreen(cam, s, sub(p, cam.eye))
/** Screen position of a direction at infinity (a star). */
export const projectDir = (cam: Cam, s: Screen, d: V3) => toScreen(cam, s, d)

/**
 * A sky direction (stars, planets, the Moon) some time later: the sky turns
 * westward about the celestial pole once per sidereal day (Rodrigues).
 */
export function turnSky(d: readonly [number, number, number], latDeg: number, dtMs: number): V3 {
  const a = (-dtMs / 86_164_090.5) * 2 * Math.PI
  const k: V3 = [0, Math.cos(latDeg * D), Math.sin(latDeg * D)]
  const c = Math.cos(a)
  const s = Math.sin(a)
  const kd = dot(k, d)
  const kx = cross(k, d)
  return [
    d[0] * c + kx[0] * s + k[0] * kd * (1 - c),
    d[1] * c + kx[1] * s + k[1] * kd * (1 - c),
    d[2] * c + kx[2] * s + k[2] * kd * (1 - c),
  ]
}

// ---------------------------------------------------------------- the pass

export type LookPoint = {
  unixMs: number
  azDeg: number
  elDeg: number
  rangeKm: number
  magnitude: number
}

/**
 * The direction to keep the camera turned to, per track sample: the station's
 * azimuth averaged over ±75 s, each moment weighted by how close to the
 * horizon it is. Near the zenith the azimuth swings wildly while the station
 * barely moves on the sky; weighting by cos(elevation) keeps the camera from
 * whipping around for a pass that goes straight overhead.
 */
export function smoothedYaw(track: readonly LookPoint[], halfWindowMs = 75_000): number[] {
  return track.map((p) => {
    let x = 0
    let y = 0
    for (const q of track) {
      const dt = Math.abs(q.unixMs - p.unixMs)
      if (dt > halfWindowMs) continue
      const w = (1 - dt / halfWindowMs) * Math.cos(q.elDeg * D)
      x += w * Math.sin(q.azDeg * D)
      y += w * Math.cos(q.azDeg * D)
    }
    return (((Math.atan2(x, y) / D) % 360) + 360) % 360
  })
}

export function yawAt(track: readonly LookPoint[], yaw: readonly number[], t: number): number {
  if (t <= track[0]!.unixMs) return yaw[0]!
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!
    const b = track[i]!
    if (t <= b.unixMs)
      return lerpAngleDeg(yaw[i - 1]!, yaw[i]!, (t - a.unixMs) / (b.unixMs - a.unixMs))
  }
  return yaw[yaw.length - 1]!
}

/** Station direction at time t, held at the ends of the track. */
export function lookAt(track: readonly LookPoint[], t: number) {
  const first = track[0]!
  const last = track[track.length - 1]!
  const c = Math.max(first.unixMs, Math.min(last.unixMs, t))
  return interpolate(track, c) ?? { azDeg: last.azDeg, elDeg: last.elDeg }
}

/** Soft version of max(0, x): no corner when the camera starts to tilt up. */
const softPlus = (x: number, k = 4) => k * Math.log1p(Math.exp(x / k))

export type GroundRig = { track: readonly LookPoint[]; yaw: readonly number[]; az0: number }

/** The camera rig for a pass: its track, the turn to follow it, the opening view. */
export function passRig(pass: ForecastPass): GroundRig {
  const track: LookPoint[] = pass.track.map((p) => ({
    unixMs: p.unixMs,
    azDeg: p.azDeg,
    elDeg: p.elDeg,
    rangeKm: p.rangeKm,
    magnitude: p.magnitude,
  }))
  return { track, yaw: smoothedYaw(track), az0: postcardView(pass).az }
}

/**
 * Standing in the yard at time t. `follow` (0 → 1) blends from the opening
 * view (facing where the pass begins) to turning with the station, which it
 * keeps about a third of the way down the screen.
 */
export function groundCamera(rig: GroundRig, t: number, s: Screen, follow: number): Cam {
  const vfov = vfovFor(s)
  const pitch0 = horizonPitchDeg(vfov, horizonFrac(s))
  const st = lookAt(rig.track, t)
  const yaw = lerpAngleDeg(rig.az0, yawAt(rig.track, rig.yaw, t), follow)
  // Keep the station in the upper part of the frame. Near the zenith the
  // camera's turn lags the station's quick swing in azimuth, so tilt up
  // closer to it there: the margin shrinks with cos(elevation).
  const lead = 0.3 * vfov * Math.cos(st.elDeg * D)
  const pitch = Math.min(80, pitch0 + follow * softPlus(st.elDeg - lead - pitch0))
  return {
    eye: [0, 0, EYE_KM],
    eyeAlt: EYE_KM,
    vfovDeg: vfov,
    ...orient(enu(yaw, pitch), [0, 0, 1]),
  }
}

/**
 * The camera on the ground for a moment of the film: facing the opening view,
 * turning with the station, or (reduced motion) holding one wide frame.
 * Nights without a pass face the thing worth seeing, and once the answer has
 * moved out of the way, tilt up until it's in the frame.
 */
export function groundView(
  rig: GroundRig | null,
  face: { azDeg: number; elDeg?: number | undefined },
  a: { beat: string; u: number; clockMs: number; follow: boolean },
  s: Screen,
): Cam {
  if (!rig) {
    const vfov = vfovFor(s)
    const pitch0 = horizonPitchDeg(vfov, horizonFrac(s))
    const target =
      face.elDeg === undefined
        ? pitch0
        : Math.max(pitch0, Math.min(60, face.elDeg - 0.3 * vfov * Math.cos(face.elDeg * D)))
    const k =
      a.beat === 'tonight' ? 0 : !a.follow || a.beat === 'settle' ? 1 : smoothstep(0, 0.18, a.u)
    return {
      eye: [0, 0, EYE_KM],
      eyeAlt: EYE_KM,
      vfovDeg: vfov,
      ...orient(enu(face.azDeg, pitch0 + k * (target - pitch0)), [0, 0, 1]),
    }
  }
  if (a.beat === 'tonight') return groundCamera(rig, a.clockMs, s, 0)
  if (!a.follow) return wideCamera(rig, s)
  const follow = a.beat === 'pass' ? smoothstep(0, 0.18, a.u) : 1
  return groundCamera(rig, a.clockMs, s, follow)
}

/** Reduced motion: one wide frame that takes in the whole pass. Nothing turns. */
export function wideCamera(rig: GroundRig, s: Screen): Cam {
  const vfov = Math.min(100, vfovFor(s) + 22)
  const maxEl = Math.max(...rig.track.map((p) => p.elDeg))
  const pitch = Math.max(horizonPitchDeg(vfov, 0.7), Math.min(45, maxEl - vfov * 0.38))
  return {
    eye: [0, 0, EYE_KM],
    eyeAlt: EYE_KM,
    vfovDeg: vfov,
    ...orient(enu(rig.az0, pitch), [0, 0, 1]),
  }
}

// ---------------------------------------------------------------- orbit

const ORBIT_ALT_KM = 5000
const ORBIT_VFOV = 60
/** Tilt from straight down towards the station, so Earth's edge shows at the top. */
const ORBIT_TILT_DEG = 6

/**
 * High above the point halfway between you and the station, looking down,
 * with "up" on the screen pointing from you towards it. You end up low in the
 * frame, the station above you, and Earth's curved edge across the top.
 */
export function orbitCamera(w: World, station: V3, fallbackAzDeg: number): Cam {
  const you: V3 = [0, 0, 1]
  const under = unit(sub(station, w.centre))
  const mid = unit(add(you, under))
  let towards = sub(under, scale(mid, dot(under, mid)))
  if (Math.hypot(...towards) < 1e-4) towards = enu(fallbackAzDeg, 0)
  towards = unit(towards)
  const eye = add(w.centre, scale(mid, w.R + ORBIT_ALT_KM))
  const forward = unit(
    add(scale(mid, -Math.cos(ORBIT_TILT_DEG * D)), scale(towards, Math.sin(ORBIT_TILT_DEG * D))),
  )
  return { eye, eyeAlt: ORBIT_ALT_KM, vfovDeg: ORBIT_VFOV, ...orient(forward, towards) }
}

/**
 * The climb, s from 0 (yard) to 1 (orbit). Height grows exponentially, so
 * every bit of scroll multiplies it by the same factor: metres, then
 * kilometres, then hundreds of kilometres, the way a real launch feels.
 * On the way up the camera looks towards the station (`watch`), then turns
 * to look down on you both for the last stretch.
 */
export function liftCamera(w: World, ground: Cam, orbit: Cam, s: number, watch?: V3): Cam {
  if (s <= 0) return ground
  if (s >= 1) return orbit
  const k = s ** 0.55
  const alt = EYE_KM * (orbit.eyeAlt / EYE_KM) ** k
  const fromCentre = slerp(
    unit(sub(ground.eye, w.centre)),
    unit(sub(orbit.eye, w.centre)),
    smoothstep(0, 1, s) ** 1.2,
  )
  const eye = add(w.centre, scale(fromCentre, w.R + alt))
  // Look along the line from your yard to the station, a fixed direction, so
  // the turn can't whip around when the camera climbs past the station's height.
  const chase = watch
    ? slerp(ground.forward, unit(sub(watch, ground.eye)), smoothstep(0, 0.5, s))
    : ground.forward
  const forward = slerp(chase, orbit.forward, smoothstep(0.45, 1, s))
  const upHint = slerp(ground.up, orbit.up, smoothstep(0.35, 1, s))
  return {
    eye,
    eyeAlt: alt,
    vfovDeg: ground.vfovDeg + (orbit.vfovDeg - ground.vfovDeg) * s,
    ...orient(forward, upHint),
  }
}
