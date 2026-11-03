// The station's side of a pass: where it is above Earth, whether it is in
// sunlight, and where the Sun is overhead. Powers "Wave Back", the view of
// Earth from the station at the minute you look up.
// Learn: docs/learn/14-wave-back.md
import { DEG, RAD } from '../math/constants.ts'
import type { Vec3 } from '../math/vec.ts'
import { ecefToGeodetic, temeToEcef } from '../frames/frames.ts'
import { sunlitFractionConical } from '../shadow/shadow.ts'
import type { Satellite } from '../propagate/propagator.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { skyAt } from './sky.ts'

export type LatLon = { latDeg: number; lonDeg: number }

export type OrbitSample = LatLon & {
  unixMs: number
  heightKm: number
  /** Fraction of the Sun's disc visible from the station, 0–1. */
  sunlit: number
}

export type StationView = {
  /** Where the station is above Earth, every 30 s around the pass. */
  samples: OrbitSample[]
  /** The point on Earth with the Sun straight overhead, at the pass's peak. */
  subsolar: LatLon
}

/** The point on the ground directly under a TEME position (geodetic). */
export function subpoint(rTeme: Vec3, gmstRad: number): LatLon & { heightKm: number } {
  const g = ecefToGeodetic(temeToEcef(rTeme, gmstRad))
  return { latDeg: g.latDeg, lonDeg: g.lonDeg, heightKm: g.heightKm }
}

/**
 * Where the Sun is overhead. Geocentric latitude: the ≤ 0.2° geodetic
 * difference is far below what a picture of the whole Earth can show.
 */
export function subsolarPoint(unixMs: number, eop: EopTable = DEFAULT_EOP): LatLon {
  const sky = skyAt(unixMs, eop)
  const [x, y, z] = temeToEcef(sky.sunTeme, sky.gmstRad)
  return {
    latDeg: Math.atan2(z, Math.hypot(x, y)) * RAD,
    lonDeg: Math.atan2(y, x) * RAD,
  }
}

/** Great-circle angle between two points, degrees. */
export function centralAngleDeg(a: LatLon, b: LatLon): number {
  const p1 = a.latDeg * DEG
  const p2 = b.latDeg * DEG
  const dl = (b.lonDeg - a.lonDeg) * DEG
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)
  return Math.acos(Math.max(-1, Math.min(1, c))) * RAD
}

/**
 * The Sun's elevation at a point on a spherical Earth, degrees. Positive in
 * daylight; −6 / −12 / −18 mark the civil / nautical / astronomical
 * twilight lines drawn on the globe.
 */
export function sunElevationAt(p: LatLon, subsolar: LatLon): number {
  return 90 - centralAngleDeg(p, subsolar)
}

/** Station positions every `stepMs` from `fromMs` to `toMs` (inclusive). */
export function stationView(
  sat: Satellite,
  fromMs: number,
  toMs: number,
  peakMs: number,
  stepMs = 30_000,
  eop: EopTable = DEFAULT_EOP,
): StationView {
  const samples: OrbitSample[] = []
  for (let t = fromMs; t <= toMs + 1; t += stepMs) {
    const sky = skyAt(t, eop)
    const r = sat.propagate(t).rTeme
    samples.push({
      unixMs: t,
      ...subpoint(r, sky.gmstRad),
      sunlit: sunlitFractionConical(r, sky.sunTeme),
    })
  }
  return { samples, subsolar: subsolarPoint(peakMs, eop) }
}
