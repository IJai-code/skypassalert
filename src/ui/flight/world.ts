// The Flight's one world: everything placed in your own east-north-up frame,
// in kilometres, with you at the origin and Earth's centre straight below at
// (0, 0, −R). The station, the Sun, the stars and the coastlines all land in
// this frame, so a single camera can stand in your yard and then rise to orbit
// without anything jumping.
// Learn: docs/learn/16-the-flight.md#world
import { geodeticToEcef } from '../../engine/frames/frames.ts'
import type { OrbitSample } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { enu } from '../../sky/projection.ts'
import { add, dot, len, scale, sub, unit, type V3 } from './vec.ts'

const D = Math.PI / 180

/** Your eyes, about 1.7 m above the ground. */
export const EYE_KM = 0.0017

export type World = {
  /** Radius of the sphere we draw, km: your distance from Earth's centre. */
  R: number
  /** Earth's centre in the frame. */
  centre: V3
  /** Earth-fixed (ECEF) position, km → this frame. */
  fromEcef(p: Readonly<V3>): V3
  /** Earth-fixed direction → this frame (no shift). */
  dirFromEcef(d: Readonly<V3>): V3
}

/**
 * Your local frame. "Up" is the ellipsoid's normal, the way a plumb line
 * hangs, which is the same "up" that the pass's azimuth and elevation use.
 */
export function makeWorld(place: Place): World {
  const lat = place.latDeg * D
  const lon = place.lonDeg * D
  const e: V3 = [-Math.sin(lon), Math.cos(lon), 0]
  const n: V3 = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]
  const u: V3 = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const origin = geodeticToEcef(place.latDeg, place.lonDeg, place.elevationM / 1000)
  const R = len(geodeticToEcef(place.latDeg, place.lonDeg, 0))
  const dirFromEcef = (d: Readonly<V3>): V3 => [dot(e, d), dot(n, d), dot(u, d)]
  return {
    R,
    centre: [0, 0, -R],
    fromEcef: (p) => dirFromEcef(sub(p, origin)),
    dirFromEcef,
  }
}

/** A point on the ground, snapped onto the drawn sphere. */
export function groundPoint(w: World, latDeg: number, lonDeg: number): V3 {
  const p = w.fromEcef(geodeticToEcef(latDeg, lonDeg, 0))
  return add(w.centre, scale(unit(sub(p, w.centre)), w.R))
}

/** Where the station is, from the orbit samples (lat, lon, height). */
export function stationFromOrbit(w: World, s: OrbitSample): V3 {
  return w.fromEcef(geodeticToEcef(s.latDeg, s.lonDeg, s.heightKm))
}

/** Where the station is, from what you'd measure: direction × distance. */
export function stationFromLook(azDeg: number, elDeg: number, rangeKm: number): V3 {
  return scale(enu(azDeg, elDeg), rangeKm)
}

/** Unit vector towards the Sun, from the point where it is straight overhead. */
export function sunDirection(w: World, subsolar: { latDeg: number; lonDeg: number }): V3 {
  const lat = subsolar.latDeg * D
  const lon = subsolar.lonDeg * D
  return w.dirFromEcef([
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ])
}

/** Height of a point above the drawn sphere, km. */
export function altitudeKm(w: World, p: V3): number {
  return len(sub(p, w.centre)) - w.R
}

/**
 * Distance along a ray to the sphere, or null if it misses. This is the CPU
 * twin of the shader's test, written the same careful way: for an eye
 * 1.7 m above a 6,371 km ball, |o|² − R² would cancel to garbage in float32,
 * so we feed in the eye's height h and use c = h(2R + h) instead.
 */
export function hitEarth(w: World, eye: V3, eyeAltKm: number, dir: V3): number | null {
  const oc = sub(eye, w.centre)
  const b = dot(oc, dir)
  const c = eyeAltKm * (2 * w.R + eyeAltKm)
  const disc = b * b - c
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  return t > 0 ? t : null
}

/** How far below level the horizon sits for an eye at this height, degrees. */
export function horizonDipDeg(R: number, eyeAltKm: number): number {
  return Math.acos(R / (R + eyeAltKm)) / D
}
