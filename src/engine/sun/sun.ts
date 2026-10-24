// The Sun's position, low precision (Astronomical Almanac, "Low-precision
// formulas for the Sun"). Stated accuracy 0.01° for 1950–2050, which is
// ~40× finer than the Sun's own diameter: plenty for darkness and shadows.
// Learn: docs/learn/03-sun.md
import { AU_KM, DEG } from '../math/constants.ts'
import type { Vec3 } from '../math/vec.ts'

/**
 * Geocentric Sun vector (km) in the mean equator and equinox of date,
 * which we treat as TEME (they differ by nutation, < 0.006°).
 */
export function sunPositionKm(jdTt: number): Vec3 {
  const n = jdTt - 2_451_545.0
  const L = (280.46 + 0.9856474 * n) * DEG
  const g = (357.528 + 0.9856003 * n) * DEG
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
  const eps = (23.439 - 0.0000004 * n) * DEG
  const rAu = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)
  const r = rAu * AU_KM
  return [
    r * Math.cos(lambda),
    r * Math.cos(eps) * Math.sin(lambda),
    r * Math.sin(eps) * Math.sin(lambda),
  ]
}
