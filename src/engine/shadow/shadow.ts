// Is the satellite in sunlight? Two models of Earth's shadow.
// Learn: docs/learn/04-shadow.md
//
// Cylindrical: Earth casts a tube of shadow with Earth's radius. Simple, and
// wrong by a few seconds at the edges because the Sun is a disc, not a point.
// Conical: compare the apparent discs of the Sun and Earth as seen *from the
// satellite*. The overlap gives the sunlit fraction: 1 in daylight, 0 in the
// umbra, in between in the penumbra (~8 s wide for the ISS). That fraction is
// why a pass "fades out" in the middle of the sky instead of switching off.
import { EARTH_EQUATORIAL_RADIUS_KM, SUN_RADIUS_KM } from '../math/constants.ts'
import { type Vec3, angleBetween, dot, norm, scale, sub, unit } from '../math/vec.ts'

/** 1 if sunlit, 0 if in the cylindrical shadow. `sat`, `sun`: geocentric km, same frame. */
export function sunlitCylindrical(
  sat: Vec3,
  sun: Vec3,
  earthRadiusKm = EARTH_EQUATORIAL_RADIUS_KM,
): number {
  const sHat = unit(sun)
  const along = dot(sat, sHat)
  if (along >= 0) return 1
  const perp = norm(sub(sat, scale(sHat, along)))
  return perp < earthRadiusKm ? 0 : 1
}

/**
 * Fraction of the solar disc visible from the satellite, in [0, 1].
 * `earthRadiusKm` can be enlarged to mimic the atmosphere's extra shadow;
 * we keep the bare ellipsoid radius and document the difference.
 */
export function sunlitFractionConical(
  sat: Vec3,
  sun: Vec3,
  earthRadiusKm = EARTH_EQUATORIAL_RADIUS_KM,
): number {
  const toSun = sub(sun, sat)
  const toEarth = scale(sat, -1)
  const a = Math.asin(SUN_RADIUS_KM / norm(toSun)) // Sun's apparent radius
  const b = Math.asin(Math.min(1, earthRadiusKm / norm(sat))) // Earth's apparent radius
  const c = angleBetween(toSun, toEarth) // separation of the two disc centres

  if (c >= a + b) return 1 // discs don't touch
  if (c <= b - a) return 0 // Sun entirely behind Earth: umbra
  if (c <= a - b) return 1 - (b * b) / (a * a) // Earth inside the Sun's disc (annular; never for LEO)

  // Partial overlap of two circles of radii a, b at centre distance c.
  const cosA = Math.min(1, Math.max(-1, (c * c + a * a - b * b) / (2 * c * a)))
  const cosB = Math.min(1, Math.max(-1, (c * c + b * b - a * a) / (2 * c * b)))
  const k = Math.max(0, (-c + a + b) * (c + a - b) * (c - a + b) * (c + a + b))
  const overlap = a * a * Math.acos(cosA) + b * b * Math.acos(cosB) - 0.5 * Math.sqrt(k)
  return Math.min(1, Math.max(0, 1 - overlap / (Math.PI * a * a)))
}
