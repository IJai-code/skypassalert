// Magnetic declination from NOAA's World Magnetic Model 2025 (public domain).
// Learn: docs/learn/11-compass.md
//
// Phone compasses point to *magnetic* north. In Fremont that is ~13° east of
// true north, enough to send someone looking at the wrong part of the sky.
// WMM is a degree-12 spherical-harmonic model of Earth's main field; we
// evaluate it exactly as the WMM technical report describes and test it
// against NOAA's published test values.
import { DEG, EARTH_E2, EARTH_EQUATORIAL_RADIUS_KM, RAD } from '../math/constants.ts'
import coefficients from './wmm2025.json' with { type: 'json' }

const REFERENCE_RADIUS_KM = 6371.2
const N_MAX = 12

type Model = { epoch: number; validUntil: number; terms: number[][] }
const MODEL = coefficients as Model

// Schmidt semi-normalisation factors S(n,m), computed once.
const SCHMIDT: number[][] = (() => {
  const s: number[][] = Array.from({ length: N_MAX + 1 }, () =>
    new Array<number>(N_MAX + 1).fill(0),
  )
  s[0]![0] = 1
  for (let n = 1; n <= N_MAX; n++) {
    s[n]![0] = (s[n - 1]![0]! * (2 * n - 1)) / n
    for (let m = 1; m <= n; m++) {
      s[n]![m] = s[n]![m - 1]! * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m))
    }
  }
  return s
})()

/** Decimal year (e.g. 2026.81) for a Unix-ms instant, as WMM expects. */
export function decimalYear(unixMs: number): number {
  const d = new Date(unixMs)
  const y = d.getUTCFullYear()
  const start = Date.UTC(y, 0, 1)
  const end = Date.UTC(y + 1, 0, 1)
  return y + (unixMs - start) / (end - start)
}

export type MagneticField = {
  /** Declination: angle from true north to magnetic north, degrees, east positive. */
  declinationDeg: number
  /** Inclination (dip), degrees, down positive. */
  inclinationDeg: number
  /** North, east, down components in nT. */
  x: number
  y: number
  z: number
}

/** Main-field components at a geodetic position and decimal year. */
export function magneticField(
  latDeg: number,
  lonDeg: number,
  heightKm: number,
  year: number,
): MagneticField {
  // Geodetic → geocentric spherical.
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const sinLat = Math.sin(lat)
  const nRad = EARTH_EQUATORIAL_RADIUS_KM / Math.sqrt(1 - EARTH_E2 * sinLat * sinLat)
  const p = (nRad + heightKm) * Math.cos(lat)
  const zc = (nRad * (1 - EARTH_E2) + heightKm) * sinLat
  const r = Math.hypot(p, zc)
  const latC = Math.asin(zc / r) // geocentric latitude
  const theta = Math.PI / 2 - latC // colatitude
  const ct = Math.cos(theta)
  const st = Math.max(Math.sin(theta), 1e-12) // guard the poles

  // Gauss-normalised associated Legendre functions and their θ-derivatives.
  const P: number[][] = Array.from({ length: N_MAX + 1 }, () =>
    new Array<number>(N_MAX + 1).fill(0),
  )
  const dP: number[][] = Array.from({ length: N_MAX + 1 }, () =>
    new Array<number>(N_MAX + 1).fill(0),
  )
  P[0]![0] = 1
  for (let n = 1; n <= N_MAX; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        P[n]![m] = st * P[n - 1]![m - 1]!
        dP[n]![m] = st * dP[n - 1]![m - 1]! + ct * P[n - 1]![m - 1]!
      } else if (n === 1) {
        P[1]![0] = ct
        dP[1]![0] = -st
      } else {
        const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3))
        const p2 = m <= n - 2 ? P[n - 2]![m]! : 0
        const dp2 = m <= n - 2 ? dP[n - 2]![m]! : 0
        P[n]![m] = ct * P[n - 1]![m]! - k * p2
        dP[n]![m] = ct * dP[n - 1]![m]! - st * P[n - 1]![m]! - k * dp2
      }
    }
  }

  const dt = year - MODEL.epoch
  let br = 0
  let bt = 0
  let bp = 0
  for (const [n, m, g0, h0, gd, hd] of MODEL.terms as Array<
    [number, number, number, number, number, number]
  >) {
    const g = g0 + gd * dt
    const h = h0 + hd * dt
    const ratio = (REFERENCE_RADIUS_KM / r) ** (n + 2)
    const s = SCHMIDT[n]![m]!
    const pnm = P[n]![m]! * s
    const dpnm = dP[n]![m]! * s
    const cm = Math.cos(m * lon)
    const sm = Math.sin(m * lon)
    br += (n + 1) * ratio * (g * cm + h * sm) * pnm
    bt -= ratio * (g * cm + h * sm) * dpnm
    bp -= (ratio * m * (-g * sm + h * cm) * pnm) / st
  }
  // Spherical (north, east, down), then rotate to the geodetic frame.
  const xs = -bt
  const ys = bp
  const zs = -br
  const psi = latC - lat
  const x = xs * Math.cos(psi) - zs * Math.sin(psi)
  const z = xs * Math.sin(psi) + zs * Math.cos(psi)
  return {
    declinationDeg: Math.atan2(ys, x) * RAD,
    inclinationDeg: Math.atan2(z, Math.hypot(x, ys)) * RAD,
    x,
    y: ys,
    z,
  }
}

/** Declination for a place now: add it to a magnetic heading to get true heading. */
export function declinationDeg(
  latDeg: number,
  lonDeg: number,
  unixMs: number,
  heightKm = 0,
): number {
  return magneticField(latDeg, lonDeg, heightKm, decimalYear(unixMs)).declinationDeg
}

export const WMM_VALID_UNTIL = MODEL.validUntil
