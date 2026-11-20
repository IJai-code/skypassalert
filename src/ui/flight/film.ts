// The Flight's content, prepared once per film and per moment (frame): which
// stars, where the stations are, what the camera sees, which labels go where.
// No WebGL and no DOM here, so all of it is testable in Node.
// Learn: docs/learn/16-the-flight.md
import type { ForecastPass, LiveOrbit } from '../../engine/index.ts'
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
  openingCamera,
  passRig,
  projectDir,
  projectPoint,
  type Cam,
  type GroundRig,
  type LookPoint,
  type Screen,
} from './camera.ts'
import { at as atP, duskTimeline, passTimeline, type At, type Timeline } from './timeline.ts'
import { add, clamp01, dot, scale, smoothstep, sub, unit, type V3 } from './vec.ts'
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

type Ribbons = { data: Float32Array; count: number; starts: number[] }

export type Film = {
  world: World
  tl: Timeline
  place: Place
  /** The pass, on a pass night. */
  pass: ForecastPass | null
  rig: GroundRig | null
  /** Which way you face in the yard (the pass's opening, or the thing to see). */
  faceAz: number
  /** How high the thing to see is, on nights without a pass. */
  faceEl?: number | undefined
  /** Where the Sun is (azimuth) at the opening moment: the opening shot looks that way. */
  sunAz: number
  /** Stars, Moon and planets are computed for this moment and turned from there. */
  refMs: number
  stars: { data: Float32Array; count: number } // [dx, dy, dz, mag, r, g, b] per star
  moon: { dir: V3; illumination: number }
  planets: Array<{ id: string; dir: V3; magnitude: number }>
  highlight: Highlight | null
  /** The visible part of the pass, as a ribbon. */
  trail: { data: Float32Array; count: number } | null
  /** Orbits seen from space: the pass's 20 minutes, or each station's live orbit. */
  orbits: Ribbons
  /** Stations drawn live (pass-free nights): where each one is, by time. */
  live: LiveOrbit[]
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
      live: readonly LiveOrbit[]
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
  const rig = pass ? passRig(pass) : null
  const live = input.kind === 'dusk' ? [...input.live] : []

  const orbitPaths = pass
    ? [pass.station.samples]
    : live.map((l) => l.samples.filter((_, i) => i % 2 === 0))

  return {
    world,
    tl,
    place,
    pass,
    rig,
    faceAz: rig ? rig.az0 : input.kind === 'dusk' ? input.faceAz : 0,
    faceEl:
      input.kind === 'dusk' && input.highlight
        ? Math.asin(Math.max(-1, Math.min(1, input.highlight.dir[2]))) / D
        : undefined,
    refMs,
    sunAz: (() => {
      const d = sunDirection(world, subsolarPoint(tl.clock0))
      return (Math.atan2(d[0], d[1]) / D + 360) % 360
    })(),
    stars: starBuffer(catalog, scene.stars.az, scene.stars.el),
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
    orbits: ribbons(
      orbitPaths.map((samples) =>
        samples.map((s) => ({
          p: stationFromOrbit(world, s),
          t: 0,
          // Bright in sunlight, a faint thread through Earth's shadow.
          b: s.sunlit >= 0.5 ? 0.95 : 0.16,
        })),
      ),
    ),
    live,
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
    if (s[2] < 6.2) keep.push(i)
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

type RibbonPoint = { p: V3; t: number; b: number }

/**
 * Paths as ribbons: each point twice (left and right edge), with its
 * neighbour so the shader can find the direction of travel.
 * Layout per vertex: [x, y, z, ox, oy, oz, side, seconds, brightness].
 */
function ribbons(paths: RibbonPoint[][]): Ribbons {
  const total = paths.reduce((n, p) => n + p.length * 2, 0)
  const data = new Float32Array(total * 9)
  const starts: number[] = []
  let v = 0
  for (const pts of paths) {
    starts.push(v)
    pts.forEach((q, i) => {
      // Keep the heading at the end by extending the last step.
      const other = i < pts.length - 1 ? pts[i + 1]!.p : add(q.p, sub(q.p, pts[i - 1]!.p))
      for (const side of [-1, 1]) data.set([...q.p, ...other, side, q.t, q.b], v++ * 9)
    })
  }
  return { data, count: v, starts }
}

/** The visible pass, three points per prediction sample so it stays smooth up close. */
function trailBuffer(pass: ForecastPass) {
  const track = pass.track
  const t0 = track[0]!.unixMs
  const t1 = track[track.length - 1]!.unixMs
  const steps = Math.max(2, (track.length - 1) * 3)
  const pts: RibbonPoint[] = []
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
  const r = ribbons([pts])
  return { data: r.data, count: r.count }
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
  // prettier-ignore
  return new Float32Array([
    t * x * x + c, t * x * y + s * z, t * x * z - s * y,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c,
  ])
}

export const spinDir = (m: Float32Array, d: V3): V3 => [
  m[0]! * d[0] + m[3]! * d[1] + m[6]! * d[2],
  m[1]! * d[0] + m[4]! * d[1] + m[7]! * d[2],
  m[2]! * d[0] + m[5]! * d[1] + m[8]! * d[2],
]

// ---------------------------------------------------------------- frames

/** Things that move with the wall clock, not the scroll: the intro and the slow drift. */
export type Ambient = {
  /** 0 → 1 over the first second the film is on screen. */
  intro: number
  /** Degrees the opening camera has swung around your town. */
  driftDeg: number
  /** Now, for stations drawn live. */
  nowMs: number
}

export const STILL: Ambient = { intro: 1, driftDeg: 0, nowMs: 0 }

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
  /** The station whose pass this is (null on pass-free nights). */
  station: { pos: V3; sunlit: number; magnitude: number } | null
  /** Live stations (pass-free nights): where each is now. */
  liveNow: Array<{ noradId: number; pos: V3; sunlit: number }>
  sprites: Float32Array // [x, y, z, w, r, g, b, a, size, ring] per sprite
  spriteCount: number
  lineOfSight: Float32Array | null
  toEcef: Float32Array
  /** 0 → 1 as the film first appears. */
  fade: number
}

const AMBER: [number, number, number] = [1, 0.776, 0.361]
const CREAM: [number, number, number] = [0.914, 0.894, 0.839]
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3

export function frameAt(
  film: Film,
  p: number,
  s: Screen,
  reducedMotion: boolean,
  amb: Ambient = STILL,
): Frame {
  const at = atP(film.tl, p, reducedMotion)
  const t = at.clockMs
  const cam = cameraAt(film, at, s, amb)
  const sun = sunDirection(film.world, subsolarPoint(t))
  const upEye = unit(sub(cam.eye, film.world.centre))
  const sunAltDeg = Math.asin(Math.max(-1, Math.min(1, dot(sun, upEye)))) / D
  const sky = skyRgb(sunAltDeg)
  // The air thins out between about 20 and 400 km up.
  const space = smoothstep(1.3, 2.6, Math.log10(Math.max(cam.eyeAlt, 1e-4)))
  const spin = skySpin(film, film.refMs, t)
  const groundLimit = limitingMagnitude(sunAltDeg)
  const limit = groundLimit + (6.2 - groundLimit) * space

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

  // You, from above: a dot and a ring.
  sprite([0, 0, 0], 1, CREAM, space, 7)
  sprite([0, 0, 0], 1, CREAM, space * 0.7, 20, 1)

  let station: Frame['station'] = null
  let lineOfSight: Float32Array | null = null
  if (film.pass && film.rig) {
    const smp = sampleAt(film.pass.station.samples, t)
    const fromLook = stationAlongTrack(film.rig.track, t)
    const fromOrbit = stationFromOrbit(film.world, smp)
    // The two agree to a few km; hand over from one to the other on the way down.
    const pos = add(scale(fromLook, 1 - space), scale(fromOrbit, space))
    const look = lookAt(film.rig.track, t)
    let magnitude = film.rig.track[film.rig.track.length - 1]!.magnitude
    for (const q of film.rig.track) if (q.unixMs <= t) magnitude = q.magnitude
    station = { pos, sunlit: smp.sunlit, magnitude }
    const lit = clamp01(smp.sunlit)
    const above = look.elDeg > -1 || space > 0.5
    const size = Math.max(6, Math.min(13, 9.5 - 1.4 * magnitude)) + space * 4
    sprite(pos, 1, AMBER, above ? lit * brightnessOf(magnitude) : 0, size)
    // From orbit, a station in Earth's shadow is still there: draw it hollow.
    sprite(pos, 1, AMBER, space * (1 - lit) * 0.9, 16, 1)
    if (space > 0.01)
      lineOfSight = new Float32Array([
        0,
        0,
        0,
        ...CREAM,
        0.5 * space,
        ...pos,
        ...CREAM,
        0.5 * space,
      ])
  }

  // Pass-free nights: both stations where they really are right now.
  const liveNow = film.live.map((l) => {
    const smp = sampleAt(l.samples, amb.nowMs || t)
    return { noradId: l.noradId, pos: stationFromOrbit(film.world, smp), sunlit: smp.sunlit }
  })
  for (const l of liveNow) {
    sprite(l.pos, 1, AMBER, space * (l.sunlit >= 0.5 ? 1 : 0), 11)
    sprite(l.pos, 1, AMBER, space * (l.sunlit < 0.5 ? 0.9 : 0), 16, 1)
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
    liveNow,
    sprites: new Float32Array(sprites),
    spriteCount: sprites.length / 10,
    lineOfSight,
    toEcef: film.world.toEcef,
    fade: reducedMotion ? 1 : easeOut(amb.intro * 1.4),
  }
}

export function cameraAt(film: Film, at: At, s: Screen, amb: Ambient = STILL): Cam {
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
  if (at.lift <= 0) return ground
  // The intro starts a third farther out and settles in. The opening shot
  // looks towards the Sun, so the sunlit edge of the air glows across the top.
  const zoom = 1 + 0.35 * (1 - easeOut(amb.intro))
  const opening = openingCamera(film.world, film.sunAz, s, amb.driftDeg, zoom)
  const watch = film.pass && film.rig ? stationAlongTrack(film.rig.track, at.clockMs) : undefined
  return liftCamera(film.world, ground, opening, at.lift, watch)
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
  o: {
    formatMinute: (ms: number) => string
    stationShort: string
    placeShort?: string
    stationName?: (noradId: number) => string
  },
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
  if (f.space > 0.02) {
    const visible = (pos: V3) => {
      const rel = sub(pos, f.cam.eye)
      const d = Math.hypot(...rel)
      const blocked = hitEarth(film.world, f.cam.eye, f.cam.eyeAlt, scale(rel, 1 / d))
      return !(blocked !== null && blocked < d * 0.999)
    }
    const you = projectPoint(f.cam, s, [0, 0, 0])
    if (you && onScreen(you.x, you.y))
      out.push({
        key: 'you',
        text: o.placeShort ? `You · ${o.placeShort}` : 'You',
        x: you.x,
        y: you.y,
        alpha: f.space,
        kind: 'you',
      })
    const named: Array<{ key: string; text: string; pos: V3 }> = []
    if (f.station) named.push({ key: 'station', text: o.stationShort, pos: f.station.pos })
    for (const l of f.liveNow)
      named.push({ key: `live-${l.noradId}`, text: o.stationName?.(l.noradId) ?? '', pos: l.pos })
    for (const n of named) {
      const p = projectPoint(f.cam, s, n.pos)
      if (n.text && p && onScreen(p.x, p.y) && visible(n.pos))
        out.push({ key: n.key, text: n.text, x: p.x, y: p.y, alpha: f.space, kind: 'station' })
    }
  }
  return out
}
