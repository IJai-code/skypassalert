// The Flight's content, prepared once per pass (film) and per moment (frame):
// which stars, where the station is, what the camera sees, which labels go
// where. No WebGL and no DOM here, so all of it is testable in Node.
// Learn: docs/learn/16-the-flight.md
import type { ForecastPass } from '../../engine/index.ts'
import { PLANET_NAMES } from '../../copy/en.ts'
import type { Place } from '../../engine/place.ts'
import { skyScene } from '../../engine/sky/scene.ts'
import { subsolarPoint } from '../../engine/sky/subpoint.ts'
import { starColor, type StarCatalog } from '../../engine/stars/stars.ts'
import { enu } from '../../sky/projection.ts'
import { limitingMagnitude, skyRgb } from '../../sky/drawSky.ts'
import { sampleAt } from '../wave/station.ts'
import type { Earth } from '../wave/earth.ts'
import {
  groundView,
  liftCamera,
  lookAt,
  orbitCamera,
  projectDir,
  projectPoint,
  passRig,
  type Cam,
  type GroundRig,
  type LookPoint,
  type Screen,
} from './camera.ts'
import { at as atP, duskTimeline, passTimeline, type At, type Timeline } from './timeline.ts'
import { clamp01, dot, scale, smoothstep, sub, unit, add, type V3 } from './vec.ts'
import {
  groundPoint,
  hitEarth,
  makeWorld,
  stationFromLook,
  stationFromOrbit,
  sunDirection,
  type World,
} from './world.ts'

const D = Math.PI / 180
const SIDEREAL_DAY_MS = 86_164_090.5

export type Highlight = { dir: V3; refMs: number; label: string }

export type Film = {
  world: World
  tl: Timeline
  place: Place
  /** The pass, on a pass night. */
  pass: ForecastPass | null
  rig: GroundRig | null
  /** Which way you face at the start (the pass's opening, or the thing to see). */
  faceAz: number
  /** How high the thing to see is, on nights without a pass. */
  faceEl?: number | undefined
  /** Stars, Moon and planets are computed for this moment and turned from there. */
  refMs: number
  stars: { data: Float32Array; count: number } // [dx, dy, dz, mag, r, g, b] per star
  moon: { dir: V3; illumination: number }
  planets: Array<{ id: string; dir: V3; magnitude: number }>
  highlight: Highlight | null
  trail: { data: Float32Array; count: number } | null
  orbitLine: { data: Float32Array; count: number } | null
  orbitCam: Cam | null
  /** Where the station is when the pass ends (the camera watches it on the climb). */
  stationEnd: V3 | null
  /** Unit vector of the sky's turning axis (towards the celestial pole). */
  pole: V3
}

export type FilmInput =
  | { kind: 'pass'; place: Place; pass: ForecastPass; nowMs: number; catalog: StarCatalog | null }
  | {
      kind: 'dusk'
      place: Place
      fromMs: number
      toMs: number
      faceAz: number
      highlight: Highlight | null
      catalog: StarCatalog | null
    }

/** Everything that stays put while you scroll. */
export function makeFilm(input: FilmInput): Film {
  const { place, catalog } = input
  const world = makeWorld(place)
  const pass = input.kind === 'pass' ? input.pass : null
  const tl =
    input.kind === 'pass'
      ? passTimeline(input.pass.start.unixMs, input.pass.end.unixMs, input.nowMs)
      : duskTimeline(input.fromMs, input.toMs)
  const refMs = pass ? pass.peak.unixMs : (tl.clock0 + tl.clock1) / 2
  const scene = skyScene(place, refMs, catalog)

  const stars = starBuffer(catalog, scene.stars.az, scene.stars.el)
  const rig = pass ? passRig(pass) : null
  const faceAz = rig ? rig.az0 : input.kind === 'dusk' ? input.faceAz : 0

  let orbitCam: Cam | null = null
  let stationEnd: V3 | null = null
  if (pass) {
    stationEnd = stationFromOrbit(world, sampleAt(pass.station.samples, pass.end.unixMs))
    orbitCam = orbitCamera(world, stationEnd, faceAz)
  }

  return {
    world,
    tl,
    place,
    pass,
    rig,
    faceAz,
    faceEl:
      input.kind === 'dusk' && input.highlight
        ? (Math.asin(Math.max(-1, Math.min(1, input.highlight.dir[2]))) * 180) / Math.PI
        : undefined,
    refMs,
    stars,
    moon: {
      dir: enu(scene.moon.azDeg, scene.moon.elDeg),
      illumination: scene.moon.illumination,
    },
    planets: scene.planets.map((p) => ({
      id: p.id,
      dir: enu(p.azDeg, p.elDeg),
      magnitude: p.magnitude,
    })),
    highlight: input.kind === 'dusk' ? input.highlight : null,
    trail: pass ? trailBuffer(pass) : null,
    orbitLine: pass ? orbitBuffer(world, pass) : null,
    orbitCam,
    stationEnd,
    pole: [0, Math.cos(place.latDeg * D), Math.sin(place.latDeg * D)],
  }
}

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function starBuffer(catalog: StarCatalog | null, az: Float32Array, el: Float32Array) {
  if (!catalog) return { data: new Float32Array(0), count: 0 }
  const keep: number[] = []
  catalog.stars.forEach((s, i) => {
    if (s[2] < 5.8) keep.push(i)
  })
  const data = new Float32Array(keep.length * 7)
  keep.forEach((i, k) => {
    const d = enu(az[i]!, el[i]!)
    const [r, g, b] = hexRgb(starColor(catalog.stars[i]![3]))
    data.set([d[0], d[1], d[2], catalog.stars[i]![2], r, g, b], k * 7)
  })
  return { data, count: keep.length }
}

/** Where the station is along the visible pass at time t (km, your frame). */
export function stationAlongTrack(track: readonly LookPoint[], t: number): V3 {
  const first = track[0]!
  const last = track[track.length - 1]!
  const c = Math.max(first.unixMs, Math.min(last.unixMs, t))
  const look = lookAt(track, c)
  let range = last.rangeKm
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!
    const b = track[i]!
    if (c <= b.unixMs) {
      range =
        a.rangeKm + ((b.rangeKm - a.rangeKm) * (c - a.unixMs)) / Math.max(1, b.unixMs - a.unixMs)
      break
    }
  }
  return stationFromLook(look.azDeg, look.elDeg, range)
}

const brightnessOf = (magnitude: number) => Math.max(0.35, Math.min(1, (5 - magnitude) / 4))

/**
 * The pass as a ribbon: each point twice (left and right edge), with its
 * neighbour so the shader can find the direction of travel. Three points per
 * prediction sample, so the curve stays smooth up close.
 * Layout per vertex: [x, y, z, ox, oy, oz, side, seconds, brightness].
 */
function trailBuffer(pass: ForecastPass) {
  const track = pass.track
  const t0 = track[0]!.unixMs
  const t1 = track[track.length - 1]!.unixMs
  const steps = Math.max(2, (track.length - 1) * 3)
  const pts: Array<{ p: V3; t: number; b: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    let mag = track[track.length - 1]!.magnitude
    for (let k = 1; k < track.length; k++)
      if (t <= track[k]!.unixMs) {
        mag = track[k - 1]!.magnitude
        break
      }
    pts.push({ p: stationAlongTrack(track, t), t: (t - t0) / 1000, b: brightnessOf(mag) })
  }
  const data = new Float32Array(pts.length * 2 * 9)
  pts.forEach((q, i) => {
    const other = i < pts.length - 1 ? pts[i + 1]!.p : add(q.p, sub(q.p, pts[i - 1]!.p)) // keep heading at the end
    for (const [k, side] of [-1, 1].entries())
      data.set([...q.p, ...other, side, q.t, q.b], (i * 2 + k) * 9)
  })
  return { data, count: pts.length * 2 }
}

const AMBER: [number, number, number] = [1, 0.776, 0.361]
const INK_3: [number, number, number] = [0.565, 0.545, 0.49]

/**
 * Twenty minutes of orbit around the pass, as a line: amber while the
 * station is in sunlight, grey once it's in Earth's shadow.
 * Layout per vertex: [x, y, z, r, g, b, a].
 */
function orbitBuffer(world: World, pass: ForecastPass) {
  const s = pass.station.samples
  const from = s[0]!.unixMs
  const to = s[s.length - 1]!.unixMs
  const n = (s.length - 1) * 4
  const data = new Float32Array((n + 1) * 7)
  for (let i = 0; i <= n; i++) {
    const smp = sampleAt(s, from + ((to - from) * i) / n)
    const lit = smp.sunlit >= 0.5
    data.set([...stationFromOrbit(world, smp), ...(lit ? AMBER : INK_3), lit ? 0.75 : 0.5], i * 7)
  }
  return { data, count: n + 1 }
}

/** Coastlines as line segments on the sphere: [x, y, z] per vertex, two per segment. */
export function coastBuffer(world: World, earth: Earth): Float32Array {
  const out: number[] = []
  for (const ring of earth.land) {
    for (let i = 2; i < ring.length; i += 2) {
      const lon0 = ring[i - 2]! / 10
      const lon1 = ring[i]! / 10
      if (Math.abs(lon1 - lon0) > 180) continue
      out.push(...groundPoint(world, ring[i - 1]! / 10, lon0))
      out.push(...groundPoint(world, ring[i + 1]! / 10, lon1))
    }
  }
  return new Float32Array(out)
}

/**
 * The sky's turn between two moments, as a column-major 3×3 matrix (for the
 * GPU). Stars are fixed to the sky, and the sky turns once per sidereal day
 * about the celestial pole, westward as seen from the ground.
 */
export function skySpin(film: Film, fromMs: number, toMs: number): Float32Array {
  const a = (-(toMs - fromMs) / SIDEREAL_DAY_MS) * 2 * Math.PI
  const [x, y, z] = film.pole
  const c = Math.cos(a)
  const s = Math.sin(a)
  const t = 1 - c
  // Rodrigues' rotation formula; GL wants columns.
  return new Float32Array([
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
  ])
}

export const spinDir = (m: Float32Array, d: V3): V3 => [
  m[0]! * d[0] + m[3]! * d[1] + m[6]! * d[2],
  m[1]! * d[0] + m[4]! * d[1] + m[7]! * d[2],
  m[2]! * d[0] + m[5]! * d[1] + m[8]! * d[2],
]

// ---------------------------------------------------------------- frames

export type Frame = {
  at: At
  cam: Cam
  sun: V3
  sunAltDeg: number
  zenith: [number, number, number]
  horizon: [number, number, number]
  glow: number
  /** 0 = under the air, 1 = above it (from the camera's height, not the scroll). */
  space: number
  spin: Float32Array
  limit: number
  /** Seconds since the pass began, for the ribbon. */
  trailClock: number
  station: { pos: V3; sunlit: number; magnitude: number } | null
  sprites: Float32Array // [x, y, z, w, r, g, b, a, size, ring] per sprite
  spriteCount: number
  lineOfSight: Float32Array | null
}

const CREAM: [number, number, number] = [0.914, 0.894, 0.839]

export function frameAt(film: Film, p: number, s: Screen, reducedMotion: boolean): Frame {
  const at = atP(film.tl, p, reducedMotion)
  const t = at.clockMs
  const cam = cameraAt(film, at, s)
  const sun = sunDirection(film.world, subsolarPoint(t))
  const upEye = unit(sub(cam.eye, film.world.centre))
  const sunAltDeg = Math.asin(Math.max(-1, Math.min(1, dot(sun, upEye)))) / D
  const sky = skyRgb(sunAltDeg)
  // The air thins out between about 20 and 400 km up.
  const space = smoothstep(1.3, 2.6, Math.log10(Math.max(cam.eyeAlt, 1e-4)))
  const spin = skySpin(film, film.refMs, t)
  const limit = limitingMagnitude(sunAltDeg) + (5.8 - limitingMagnitude(sunAltDeg)) * space

  const sprites: number[] = []
  const sprite = (
    pos: V3,
    w: 0 | 1,
    rgb: [number, number, number],
    a: number,
    size: number,
    ring = 0,
  ) => {
    if (a > 0.004) sprites.push(...pos, w, ...rgb, a, size, ring)
  }

  const m = film.moon
  sprite(spinDir(spin, m.dir), 0, CREAM, 0.35 + 0.6 * m.illumination, 9 + 5 * m.illumination)
  for (const pl of film.planets)
    if (pl.magnitude < limit)
      sprite(
        spinDir(spin, pl.dir),
        0,
        CREAM,
        0.95,
        Math.max(3, Math.min(7, 5 - 0.8 * pl.magnitude)),
      )
  if (film.highlight) {
    const h = film.highlight
    sprite(spinDir(skySpin(film, h.refMs, t), h.dir), 0, CREAM, 0.85 * (1 - space), 30, 1)
  }

  let station: Frame['station'] = null
  let lineOfSight: Float32Array | null = null
  if (film.pass && film.rig) {
    const smp = sampleAt(film.pass.station.samples, t)
    const fromLook = stationAlongTrack(film.rig.track, t)
    const fromOrbit = stationFromOrbit(film.world, smp)
    // The two agree to a few km; hand over from one to the other on the climb.
    const pos = add(scale(fromLook, 1 - space), scale(fromOrbit, space))
    const look = lookAt(film.rig.track, t)
    let magnitude = film.rig.track[film.rig.track.length - 1]!.magnitude
    for (const q of film.rig.track) if (q.unixMs <= t) magnitude = q.magnitude
    station = { pos, sunlit: smp.sunlit, magnitude }
    const lit = clamp01(smp.sunlit)
    const above = look.elDeg > -1 || space > 0.5
    sprite(
      pos,
      1,
      AMBER,
      above ? lit * brightnessOf(magnitude) : 0,
      Math.max(6, Math.min(13, 9.5 - 1.4 * magnitude)),
    )
    // From orbit, a station in Earth's shadow is still there: draw it hollow.
    sprite(pos, 1, AMBER, space * (1 - lit) * 0.9, 15, 1)
    sprite([0, 0, 0], 1, CREAM, space, 6)
    sprite([0, 0, 0], 1, CREAM, space * 0.7, 18, 1)
    if (space > 0.01)
      lineOfSight = new Float32Array([
        0,
        0,
        0,
        ...CREAM,
        0.45 * space,
        ...pos,
        ...CREAM,
        0.45 * space,
      ])
  }

  return {
    at,
    cam,
    sun,
    sunAltDeg,
    zenith: sky.zenith.map((v) => v / 255) as [number, number, number],
    horizon: sky.horizon.map((v) => v / 255) as [number, number, number],
    glow: sky.glowStrength,
    space,
    spin,
    limit,
    trailClock: film.pass ? (t - film.pass.track[0]!.unixMs) / 1000 : 0,
    station,
    sprites: new Float32Array(sprites),
    spriteCount: sprites.length / 10,
    lineOfSight,
  }
}

export function cameraAt(film: Film, at: At, s: Screen): Cam {
  // On a pass-free night, keep facing the thing to see as the sky turns.
  let face: { azDeg: number; elDeg?: number | undefined } = {
    azDeg: film.faceAz,
    elDeg: film.faceEl,
  }
  if (!film.rig && film.highlight) {
    const d = spinDir(skySpin(film, film.highlight.refMs, at.clockMs), film.highlight.dir)
    face = {
      azDeg: (Math.atan2(d[0], d[1]) / D + 360) % 360,
      elDeg: Math.asin(Math.max(-1, Math.min(1, d[2]))) / D,
    }
  }
  const ground = groundView(film.rig, face, at, s)
  return film.orbitCam && at.lift > 0
    ? liftCamera(film.world, ground, film.orbitCam, at.lift, film.stationEnd ?? undefined)
    : ground
}

// ---------------------------------------------------------------- labels

export type Label = {
  key: string
  text: string
  x: number
  y: number
  alpha: number
  kind: 'compass' | 'minute' | 'you' | 'station' | 'thing'
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** Text that rides on the picture, placed by the same maths as the GPU. */
export function labelsAt(
  film: Film,
  f: Frame,
  s: Screen,
  o: { formatMinute: (ms: number) => string; stationShort: string },
): Label[] {
  const out: Label[] = []
  const onScreen = (x: number, y: number) =>
    x > -40 && x < s.width + 40 && y > -20 && y < s.height + 20
  const ground = 1 - clamp01(f.space * 3)
  if (ground > 0.02) {
    COMPASS.forEach((name, i) => {
      const p = projectDir(f.cam, s, enu(i * 45, 0))
      if (p && onScreen(p.x, p.y))
        out.push({ key: `c-${name}`, text: name, x: p.x, y: p.y, alpha: ground, kind: 'compass' })
    })
  }
  if (film.rig && ground > 0.02) {
    const track = film.rig.track
    const t0 = track[0]!.unixMs
    const t1 = track[track.length - 1]!.unixMs
    for (let m = Math.ceil(t0 / 60_000) * 60_000; m <= t1; m += 60_000) {
      const p = projectPoint(f.cam, s, stationAlongTrack(track, m))
      if (p && onScreen(p.x, p.y))
        out.push({
          key: `m-${m}`,
          text: o.formatMinute(m),
          x: p.x,
          y: p.y,
          alpha: ground * (m <= f.at.clockMs ? 0.95 : 0.55),
          kind: 'minute',
        })
    }
  }
  // The Moon and the naked-eye planets, by name, while they're above your horizon.
  if (ground > 0.02) {
    const sky = (d: V3, key: string, text: string) => {
      const v = spinDir(f.spin, d)
      if (v[2] < 0.01 || text === film.highlight?.label) return
      const p = projectDir(f.cam, s, v)
      if (p && onScreen(p.x, p.y))
        out.push({ key, text, x: p.x, y: p.y, alpha: ground * 0.85, kind: 'thing' })
    }
    sky(film.moon.dir, 'moon', 'Moon')
    for (const pl of film.planets)
      if (pl.magnitude < f.limit) sky(pl.dir, `pl-${pl.id}`, PLANET_NAMES[pl.id] ?? pl.id)
  }
  if (film.highlight && ground > 0.02) {
    const h = film.highlight
    const p = projectDir(f.cam, s, spinDir(skySpin(film, h.refMs, f.at.clockMs), h.dir))
    if (p && onScreen(p.x, p.y))
      out.push({ key: 'thing', text: h.label, x: p.x, y: p.y, alpha: ground, kind: 'thing' })
  }
  if (f.space > 0.02 && f.station) {
    const you = projectPoint(f.cam, s, [0, 0, 0])
    if (you && onScreen(you.x, you.y))
      out.push({ key: 'you', text: 'You', x: you.x, y: you.y, alpha: f.space, kind: 'you' })
    const st = f.station.pos
    const rel = sub(st, f.cam.eye)
    const d = Math.hypot(...rel)
    const blocked = hitEarth(film.world, f.cam.eye, f.cam.eyeAlt, scale(rel, 1 / d))
    const p = projectPoint(f.cam, s, st)
    if (p && onScreen(p.x, p.y) && !(blocked !== null && blocked < d * 0.999))
      out.push({
        key: 'station',
        text: o.stationShort,
        x: p.x,
        y: p.y,
        alpha: f.space,
        kind: 'station',
      })
  }
  return out
}
