// The Moon's position and phase, after Paul Schlyter's "How to compute
// planetary positions" (orbital elements of date + the 12 largest longitude,
// 5 latitude and 2 distance perturbations). Accuracy ~1–2 arcminutes, a
// fraction of the Moon's 31′ width. Good enough to say "just below the Moon".
// Learn: docs/learn/10-sky-objects.md#moon
import { DEG, EARTH_EQUATORIAL_RADIUS_KM } from '../math/constants.ts'
import { type Vec3, wrapTwoPi } from '../math/vec.ts'

const d2r = (x: number) => wrapTwoPi(x * DEG)

/** Solve Kepler's equation E − e·sin E = M (radians). */
export function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M))
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

/** Geocentric Moon vector (km), mean equator and equinox of date. */
export function moonPositionKm(jdTt: number): Vec3 {
  // Schlyter's day number: d = 0 at 2000 Jan 0.0.
  const d = jdTt - 2_451_543.5

  const N = d2r(125.1228 - 0.0529538083 * d)
  const i = 5.1454 * DEG
  const w = d2r(318.0634 + 0.1643573223 * d)
  const a = 60.2666 // Earth radii
  const e = 0.0549
  const M = d2r(115.3654 + 13.0649929509 * d)

  const E = solveKepler(M, e)
  const xv = a * (Math.cos(E) - e)
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const v = Math.atan2(yv, xv)
  const r = Math.hypot(xv, yv)

  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i))
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i))
  const zh = r * Math.sin(v + w) * Math.sin(i)

  let lon = Math.atan2(yh, xh)
  let lat = Math.atan2(zh, Math.hypot(xh, yh))
  let dist = r

  // Perturbations. Ms, ws: the Sun's mean anomaly and perihelion argument.
  const Ms = d2r(356.047 + 0.9856002585 * d)
  const ws = d2r(282.9404 + 4.70935e-5 * d)
  const Ls = Ms + ws
  const Lm = M + w + N
  const D = Lm - Ls
  const F = Lm - N
  const Mm = M

  lon +=
    (-1.274 * Math.sin(Mm - 2 * D) + // evection
      0.658 * Math.sin(2 * D) + // variation
      -0.186 * Math.sin(Ms) + // yearly equation
      -0.059 * Math.sin(2 * Mm - 2 * D) +
      -0.057 * Math.sin(Mm - 2 * D + Ms) +
      0.053 * Math.sin(Mm + 2 * D) +
      0.046 * Math.sin(2 * D - Ms) +
      0.041 * Math.sin(Mm - Ms) +
      -0.035 * Math.sin(D) + // parallactic equation
      -0.031 * Math.sin(Mm + Ms) +
      -0.015 * Math.sin(2 * F - 2 * D) +
      0.011 * Math.sin(Mm - 4 * D)) *
    DEG
  lat +=
    (-0.173 * Math.sin(F - 2 * D) +
      -0.055 * Math.sin(Mm - F - 2 * D) +
      -0.046 * Math.sin(Mm + F - 2 * D) +
      0.033 * Math.sin(F + 2 * D) +
      0.017 * Math.sin(2 * Mm + F)) *
    DEG
  dist += -0.58 * Math.cos(Mm - 2 * D) - 0.46 * Math.cos(2 * D)

  const rKm = dist * EARTH_EQUATORIAL_RADIUS_KM
  const xe = rKm * Math.cos(lon) * Math.cos(lat)
  const ye = rKm * Math.sin(lon) * Math.cos(lat)
  const ze = rKm * Math.sin(lat)
  const ecl = (23.4393 - 3.563e-7 * d) * DEG
  return [xe, ye * Math.cos(ecl) - ze * Math.sin(ecl), ye * Math.sin(ecl) + ze * Math.cos(ecl)]
}
