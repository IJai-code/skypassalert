// IAU 1976 precession: J2000 mean equator/equinox → mean equator/equinox of date.
// Learn: docs/learn/10-sky-objects.md#precession
//
// Earth's axis sweeps a 26,000-year cone, so a star's J2000 coordinates drift
// ~50″ per year. By 2026 that is ~0.36°: small, but bigger than every other
// error in our planet model, so it has to be applied.
import { DEG } from '../math/constants.ts'
import { type Vec3, rotateZ } from '../math/vec.ts'

const ARCSEC = DEG / 3600

function rotateY(v: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]
}

/** Precess an equatorial J2000 vector to mean-of-date. `t` = Julian centuries (TT) since J2000. */
export function precessFromJ2000(v: Vec3, t: number): Vec3 {
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSEC
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSEC
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSEC
  // P = R3(−z) · R2(θ) · R3(−ζ) with *frame* (passive) rotations, applied right
  // to left. A passive rotation by φ equals an active rotation of the vector by
  // −φ, hence the signs below (rotateZ/rotateY rotate the vector itself).
  return rotateZ(rotateY(rotateZ(v, zeta), -theta), z)
}

/** Mean obliquity of the ecliptic (IAU 1980), radians, `t` in Julian centuries TT. */
export function meanObliquity(t: number): number {
  return (84_381.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t) * ARCSEC
}

/** Ecliptic → equatorial: rotate about x by +ε. */
export function eclipticToEquatorial(v: Vec3, epsRad: number): Vec3 {
  const c = Math.cos(epsRad)
  const s = Math.sin(epsRad)
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]
}
