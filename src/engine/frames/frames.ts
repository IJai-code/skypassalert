// Coordinate frames: TEME → ECEF → geodetic, and the observer's
// topocentric azimuth / elevation / range.
// Learn: docs/learn/02-frames.md
import {
  DEG,
  EARTH_E2,
  EARTH_EQUATORIAL_RADIUS_KM,
  RAD,
  EARTH_FLATTENING,
} from '../math/constants.ts'
import { type Vec3, rotateZ, sub, wrap360 } from '../math/vec.ts'

/**
 * TEME (SGP4 output, km) → Earth-fixed (ECEF, km): rotate by −GMST about z.
 *
 * Approximation: polar motion (the ~10 m wobble of the rotation axis
 * relative to the crust) is neglected. That bounds this step's error at
 * roughly 10–15 m on the ground and ~0.0003° in look angle for a station
 * 400 km away. See docs/learn/02-frames.md#polar-motion.
 */
export function temeToEcef(rTeme: Vec3, gmstRad: number): Vec3 {
  return rotateZ(rTeme, -gmstRad)
}

/** Inverse of temeToEcef. */
export function ecefToTeme(rEcef: Vec3, gmstRad: number): Vec3 {
  return rotateZ(rEcef, gmstRad)
}

/** Geodetic latitude/longitude (degrees) and height above the WGS-84 ellipsoid (km) → ECEF km. */
export function geodeticToEcef(latDeg: number, lonDeg: number, heightKm: number): Vec3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  // Prime-vertical radius of curvature.
  const n = EARTH_EQUATORIAL_RADIUS_KM / Math.sqrt(1 - EARTH_E2 * sinLat * sinLat)
  return [
    (n + heightKm) * cosLat * Math.cos(lon),
    (n + heightKm) * cosLat * Math.sin(lon),
    (n * (1 - EARTH_E2) + heightKm) * sinLat,
  ]
}

/**
 * ECEF km → geodetic (degrees, km). Bowring's closed form followed by two
 * fixed-point refinements; converges to < 1 mm for any point near Earth.
 */
export function ecefToGeodetic(r: Vec3): { latDeg: number; lonDeg: number; heightKm: number } {
  const [x, y, z] = r
  const a = EARTH_EQUATORIAL_RADIUS_KM
  const b = a * (1 - EARTH_FLATTENING)
  const p = Math.hypot(x, y)
  const ep2 = (a * a - b * b) / (b * b)
  const theta = Math.atan2(z * a, p * b)
  let lat = Math.atan2(z + ep2 * b * Math.sin(theta) ** 3, p - EARTH_E2 * a * Math.cos(theta) ** 3)
  let height = 0
  for (let i = 0; i < 2; i++) {
    const sinLat = Math.sin(lat)
    const n = a / Math.sqrt(1 - EARTH_E2 * sinLat * sinLat)
    height = p / Math.cos(lat) - n
    lat = Math.atan2(z, p * (1 - (EARTH_E2 * n) / (n + height)))
  }
  return { latDeg: lat * RAD, lonDeg: Math.atan2(y, x) * RAD, heightKm: height }
}

export type LookAngles = {
  /** Degrees clockwise from true north, [0, 360). */
  azDeg: number
  /** Degrees above the horizon (geometric, no refraction). */
  elDeg: number
  rangeKm: number
}

/**
 * Topocentric look angles from an observer to a target, both in ECEF km.
 * The local frame is South-East-Zenith, rotated from ECEF by longitude and
 * geodetic latitude (the ellipsoid normal, i.e. "straight up" for a person).
 */
export function lookAngles(
  observerEcef: Vec3,
  latDeg: number,
  lonDeg: number,
  targetEcef: Vec3,
): LookAngles {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const [dx, dy, dz] = sub(targetEcef, observerEcef)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)

  const south = sinLat * cosLon * dx + sinLat * sinLon * dy - cosLat * dz
  const east = -sinLon * dx + cosLon * dy
  const zenith = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz

  const rangeKm = Math.hypot(south, east, zenith)
  return {
    azDeg: wrap360(Math.atan2(east, -south) * RAD),
    elDeg: Math.asin(zenith / rangeKm) * RAD,
    rangeKm,
  }
}

/**
 * Atmospheric refraction (Sæmundsson 1986, the inverse of Bennett's formula),
 * degrees to add to a *geometric* elevation for standard conditions
 * (10 °C, 1010 hPa). ~0.57° at the horizon,
 * 0.09° at 10°, under 0.02° above 45°. Used for display and sunset times.
 */
export function refractionDeg(elDeg: number): number {
  if (elDeg < -2) return 0
  const h = Math.max(elDeg, -1.9)
  return 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG) / 60
}
