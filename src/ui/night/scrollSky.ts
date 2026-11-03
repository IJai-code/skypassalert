// Turns the scroll position into a moment and a direction, and paints the
// real sky for it. Each stop on the page is two keyframes (where its span
// starts and ends); between keyframes the clock and the view glide.
// Docs: docs/DESIGN.md#the-night
import type { ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { skyScene, type SkyScene } from '../../engine/sky/scene.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { drawSky, interpolate } from '../../sky/drawSky.ts'
import { basisLookingAt } from '../../sky/projection.ts'

export type Keyframe = {
  y: number
  t: number
  az: number
  pass: ForecastPass | null
  /** Fraction of the height where the horizon sits (the answer needs more ground). */
  horizon: number
}

export type SkyMoment = {
  t: number
  az: number
  /** The pass whose stretch of the page we are in, if any. */
  pass: ForecastPass | null
  /** True while the clock is inside that pass (draw the station itself). */
  live: boolean
  horizon: number
}

const ease = (x: number) => x * x * (3 - 2 * x)

/** Shortest turn from a to b, degrees in (−180, 180]. */
const turn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180

export function momentAt(frames: readonly Keyframe[], y: number): SkyMoment | null {
  const first = frames[0]
  if (!first) return null
  if (y <= first.y)
    return { t: first.t, az: first.az, pass: first.pass, live: false, horizon: first.horizon }
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]!
    const b = frames[i]!
    if (y > b.y) continue
    const f = (y - a.y) / Math.max(1, b.y - a.y)
    // Inside one pass the clock runs linearly (it is the pass itself); between
    // stops it eases so the sky settles at each one.
    const samePass = a.pass !== null && a.pass === b.pass
    const k = samePass ? f : ease(f)
    const t = a.t + (b.t - a.t) * k
    const pass = samePass ? a.pass : f < 0.5 ? a.pass : b.pass
    return {
      t,
      az: (a.az + turn(a.az, b.az) * k + 360) % 360,
      pass,
      live: samePass,
      horizon: a.horizon + (b.horizon - a.horizon) * ease(f),
    }
  }
  const last = frames[frames.length - 1]!
  return { t: last.t, az: last.az, pass: last.pass, live: false, horizon: last.horizon }
}

/** Stars move 0.25°/min: one scene per minute is plenty while scrolling. */
export function makeSceneCache(place: Place, catalog: StarCatalog | null) {
  let key = NaN
  let scene: SkyScene | null = null
  return (t: number): SkyScene => {
    const k = Math.floor(t / 60_000)
    if (k !== key || !scene) {
      key = k
      scene = skyScene(place, k * 60_000, catalog)
    }
    return scene
  }
}

/** Where the horizon sits on a stop: high enough to leave dark ground for the words. */
export const HORIZON_AT = 0.46
/** The answer screen carries the most words, so its horizon sits higher still. */
export const HERO_HORIZON_AT = 0.36

export function paintMoment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: SkyMoment,
  scene: SkyScene,
  catalog: StarCatalog | null,
  red: boolean,
  formatMinute: (ms: number) => string,
) {
  // A wide stereographic view (like the hero picture) with the horizon at
  // m.horizon; the view centre sits 26% higher (y = 2k·tan(θ/2)).
  const vfov = Math.max(80, Math.min(125, (112 * h) / Math.max(w, 1)))
  const centre = Math.max(0.1, m.horizon - 0.26)
  const q = (m.horizon - centre) * 2
  const el = (2 * Math.atan(q * Math.tan((vfov * Math.PI) / 720)) * 180) / Math.PI
  const station = m.pass && m.live ? interpolate(m.pass.track, m.t) : null
  drawSky(ctx, {
    vp: { width: w, height: h, vfovDeg: vfov, projection: 'stereographic', cy: h * centre },
    cam: basisLookingAt(m.az, el),
    scene,
    catalog,
    opaque: true,
    red,
    track: m.pass?.track ?? null,
    station,
    formatMinute,
    labels: true,
  })
}
