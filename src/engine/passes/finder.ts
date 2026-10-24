// The pass finder: when is a satellite above the horizon, in sunlight, while
// the observer's sky is dark? Coarse scan + Brent root-finding on each edge.
// Learn: docs/learn/05-passes.md
import { brentMax, brentRoot } from '../math/roots.ts'
import { angleBetween, sub } from '../math/vec.ts'
import { lookAtTeme, makeObserver, type Observer } from '../frames/observer.ts'
import type { LookAngles } from '../frames/frames.ts'
import type { Place } from '../place.ts'
import type { Satellite } from '../propagate/propagator.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { skyAt, sunLook } from '../sky/sky.ts'
import { sunlitCylindrical, sunlitFractionConical } from '../shadow/shadow.ts'
import {
  DEFAULT_STANDARD_MAGNITUDE,
  STANDARD_MAGNITUDE,
  satelliteMagnitude,
} from '../brightness/brightness.ts'
import { ecefToTeme } from '../frames/frames.ts'

export type PassOptions = {
  /** Lowest elevation that counts as "up" (trees, houses). Default 10°. */
  minElevationDeg: number
  /** Sky must be at least this dark: Sun altitude ≤ this. Default −6° (end of civil twilight). */
  maxSunAltitudeDeg: number
  /** Coarse scan step, seconds. 20 s cannot skip a pass that clears 10°. */
  stepSeconds: number
  shadowModel: 'conical' | 'cylindrical'
  eop: EopTable
}

export const DEFAULT_PASS_OPTIONS: PassOptions = {
  minElevationDeg: 10,
  maxSunAltitudeDeg: -6,
  stepSeconds: 20,
  shadowModel: 'conical',
  eop: DEFAULT_EOP,
}

export type PassPoint = LookAngles & { unixMs: number }

export type StartReason = 'rise' | 'leaves-shadow' | 'sky-darkens' | 'window-start'
export type EndReason = 'sets' | 'enters-shadow' | 'sky-brightens' | 'window-end'

export type VisiblePass = {
  noradId: number
  name: string
  /** First moment it is above the minimum elevation, sunlit, in a dark sky. */
  start: PassPoint & { reason: StartReason }
  /** Highest point while visible. */
  peak: PassPoint & { magnitude: number }
  end: PassPoint & { reason: EndReason }
  /** Brightest magnitude while visible (lower = brighter). */
  brightestMagnitude: number
  /** Sun altitude at the visible peak, degrees (how dark the sky is). */
  sunAltitudeDeg: number
  /** ~40 evenly spaced points across the visible part, for drawing the arc. */
  track: Array<PassPoint & { magnitude: number }>
}

type Evaluator = {
  look(t: number): LookAngles
  /** Everything needed for visibility + brightness at t. */
  state(t: number): { look: LookAngles; sunAlt: number; sunlit: number; magnitude: number }
}

function makeEvaluator(sat: Satellite, observer: Observer, opts: PassOptions): Evaluator {
  const m0 = STANDARD_MAGNITUDE[sat.noradId] ?? DEFAULT_STANDARD_MAGNITUDE
  const look = (t: number) => {
    const sky = skyAt(t, opts.eop)
    return lookAtTeme(observer, sat.propagate(t).rTeme, sky.gmstRad)
  }
  const state = (t: number) => {
    const sky = skyAt(t, opts.eop)
    const r = sat.propagate(t).rTeme
    const l = lookAtTeme(observer, r, sky.gmstRad)
    const sunAlt = sunLook(observer, sky).elDeg
    const sunlit =
      opts.shadowModel === 'conical'
        ? sunlitFractionConical(r, sky.sunTeme)
        : sunlitCylindrical(r, sky.sunTeme)
    // Phase angle at the satellite between the Sun and the observer.
    const obsTeme = ecefToTeme(observer.ecef, sky.gmstRad)
    const phase = angleBetween(sub(sky.sunTeme, r), sub(obsTeme, r))
    const magnitude = satelliteMagnitude({
      standardMagnitude: m0,
      rangeKm: l.rangeKm,
      phaseRad: phase,
      sunlitFraction: sunlit,
    })
    return { look: l, sunAlt, sunlit, magnitude }
  }
  return { look, state }
}

const TIME_TOL_MS = 50

/** Visible passes of one satellite between two instants (Unix ms). */
export function findPasses(
  sat: Satellite,
  place: Place,
  fromMs: number,
  toMs: number,
  options: Partial<PassOptions> = {},
): VisiblePass[] {
  const opts = { ...DEFAULT_PASS_OPTIONS, ...options }
  const ev = makeEvaluator(sat, makeObserver(place), opts)
  const intervals = aboveIntervals(ev, fromMs, toMs, opts)
  const passes: VisiblePass[] = []
  for (const iv of intervals) passes.push(...visibleParts(sat, ev, iv, opts))
  return passes
}

export type AboveInterval = { rise: number; set: number; riseClipped: boolean; setClipped: boolean }

/** Every interval in [fromMs, toMs] when the satellite is above the minimum elevation, day or night. */
export function findAboveIntervals(
  sat: Satellite,
  place: Place,
  fromMs: number,
  toMs: number,
  options: Partial<PassOptions> = {},
): AboveInterval[] {
  const opts = { ...DEFAULT_PASS_OPTIONS, ...options }
  return aboveIntervals(makeEvaluator(sat, makeObserver(place), opts), fromMs, toMs, opts)
}

function aboveIntervals(
  ev: Evaluator,
  fromMs: number,
  toMs: number,
  opts: PassOptions,
): AboveInterval[] {
  const minEl = opts.minElevationDeg
  const above = (t: number) => ev.look(t).elDeg - minEl
  const step = opts.stepSeconds * 1000

  // Coarse scan for intervals above the minimum elevation, refined with Brent.
  const intervals: AboveInterval[] = []
  let prevT = fromMs
  let prevF = above(prevT)
  let prevPrevF = Number.NaN
  let openRise: number | null = prevF > 0 ? fromMs : null
  let riseClipped = prevF > 0

  for (let t = fromMs + step; t <= toMs + step; t += step) {
    const tc = Math.min(t, toMs)
    const f = above(tc)
    if (prevF <= 0 && f > 0) {
      openRise = brentRoot(above, prevT, tc, TIME_TOL_MS)
      riseClipped = false
    } else if (prevF > 0 && f <= 0 && openRise !== null) {
      intervals.push({
        rise: openRise,
        set: brentRoot(above, prevT, tc, TIME_TOL_MS),
        riseClipped,
        setClipped: false,
      })
      openRise = null
    } else if (prevF <= 0 && f <= 0 && prevPrevF < prevF && prevF > f && prevF > -3) {
      // A local maximum just below the threshold between samples: check whether the
      // true peak pokes above it (a short, low pass the coarse grid stepped over).
      const lo = prevT - step
      const pk = brentMax(above, Math.max(fromMs, lo), tc, TIME_TOL_MS)
      if (pk.value > 0) {
        intervals.push({
          rise: brentRoot(above, Math.max(fromMs, lo), pk.t, TIME_TOL_MS),
          set: brentRoot(above, pk.t, tc, TIME_TOL_MS),
          riseClipped: false,
          setClipped: false,
        })
      }
    }
    prevPrevF = prevF
    prevT = tc
    prevF = f
    if (tc === toMs) break
  }
  if (openRise !== null)
    intervals.push({ rise: openRise, set: toMs, riseClipped, setClipped: true })
  return intervals
}

function visibleParts(
  sat: Satellite,
  ev: Evaluator,
  iv: AboveInterval,
  opts: PassOptions,
): VisiblePass[] {
  const shadowF = (t: number) => ev.state(t).sunlit - 0.5
  const darkF = (t: number) => opts.maxSunAltitudeDeg - ev.state(t).sunAlt
  const isVisible = (s: ReturnType<Evaluator['state']>) =>
    s.sunlit >= 0.5 && s.sunAlt <= opts.maxSunAltitudeDeg

  const fine = 2_000
  const runs: Array<{
    start: number
    end: number
    startReason: StartReason
    endReason: EndReason
  }> = []
  let prevT = iv.rise
  let prev = ev.state(prevT)
  let runStart: number | null = isVisible(prev) ? iv.rise : null
  let runStartReason: StartReason = iv.riseClipped ? 'window-start' : 'rise'

  const edge = (a: number, b: number, sa: ReturnType<Evaluator['state']>) => {
    // Which condition flipped between a and b? Refine that one.
    const sb = ev.state(b)
    const shadowFlip = sa.sunlit >= 0.5 !== sb.sunlit >= 0.5
    const f = shadowFlip ? shadowF : darkF
    return { t: brentRoot(f, a, b, TIME_TOL_MS), shadow: shadowFlip }
  }

  for (let t = iv.rise + fine; ; t += fine) {
    const tc = Math.min(t, iv.set)
    const cur = ev.state(tc)
    const v0 = isVisible(prev)
    const v1 = isVisible(cur)
    if (!v0 && v1) {
      const e = edge(prevT, tc, prev)
      runStart = e.t
      runStartReason = e.shadow ? 'leaves-shadow' : 'sky-darkens'
    } else if (v0 && !v1 && runStart !== null) {
      const e = edge(prevT, tc, prev)
      runs.push({
        start: runStart,
        end: e.t,
        startReason: runStartReason,
        endReason: e.shadow ? 'enters-shadow' : 'sky-brightens',
      })
      runStart = null
    }
    prevT = tc
    prev = cur
    if (tc >= iv.set) break
  }
  if (runStart !== null) {
    runs.push({
      start: runStart,
      end: iv.set,
      startReason: runStartReason,
      endReason: iv.setClipped ? 'window-end' : 'sets',
    })
  }

  return runs
    .filter((r) => r.end - r.start >= 10_000)
    .map((r) => {
      const pk = brentMax((t) => ev.look(t).elDeg, r.start, r.end, TIME_TOL_MS)
      const at = (t: number) => ({ unixMs: t, ...ev.look(t) })
      const peakState = ev.state(pk.t)
      const n = 40
      const track = Array.from({ length: n + 1 }, (_, k) => {
        const t = r.start + ((r.end - r.start) * k) / n
        const s = ev.state(t)
        return { unixMs: t, ...s.look, magnitude: s.magnitude }
      })
      const brightest = Math.min(peakState.magnitude, ...track.map((p) => p.magnitude))
      return {
        noradId: sat.noradId,
        name: sat.name,
        start: { ...at(r.start), reason: r.startReason },
        peak: { unixMs: pk.t, ...peakState.look, magnitude: peakState.magnitude },
        end: { ...at(r.end), reason: r.endReason },
        brightestMagnitude: brightest,
        sunAltitudeDeg: peakState.sunAlt,
        track,
      }
    })
}
