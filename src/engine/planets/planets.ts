// Naked-eye planets from JPL's "Approximate Positions of the Planets"
// (E. M. Standish, Table 1: Keplerian elements + linear rates, mean ecliptic
// and equinox of J2000, valid 1800–2050). JPL quotes errors of tens of
// arcseconds for the inner planets and up to ~10′ for Saturn: far below
// what the eye can tell, and the right trade for a few hundred bytes of data.
// Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Learn: docs/learn/10-sky-objects.md#planets
import { AU_KM, DEG, RAD } from '../math/constants.ts'
import { type Vec3, angleBetween, dot, norm, scale, sub, unit } from '../math/vec.ts'
import { solveKepler } from '../moon/moon.ts'
import { eclipticToEquatorial, precessFromJ2000 } from '../frames/precession.ts'

export type PlanetId = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'

type Elements = readonly [a: number, e: number, I: number, L: number, peri: number, node: number]

// [value at J2000, rate per Julian century] for a (au), e, I, L, ϖ, Ω (degrees).
const TABLE: Record<PlanetId | 'emb', readonly [Elements, Elements]> = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  emb: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
}

/** Heliocentric ecliptic-J2000 position in au for `t` Julian centuries (TT) since J2000. */
function heliocentricAu(body: PlanetId | 'emb', t: number): Vec3 {
  const [base, rate] = TABLE[body]
  const el = base.map((v, k) => v + (rate[k] ?? 0) * t) as unknown as Elements
  const [a, e, I, L, peri, node] = el
  const omega = (peri - node) * DEG // argument of perihelion
  const M = ((((L - peri) % 360) + 540) % 360) - 180 // mean anomaly in (−180, 180]
  const E = solveKepler(M * DEG, e)
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const cw = Math.cos(omega)
  const sw = Math.sin(omega)
  const cO = Math.cos(node * DEG)
  const sO = Math.sin(node * DEG)
  const cI = Math.cos(I * DEG)
  const sI = Math.sin(I * DEG)
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ]
}

/** J2000 mean obliquity, used with the J2000 ecliptic elements above. */
const EPS_J2000 = 23.43928 * DEG
const LIGHT_DAYS_PER_AU = 499.004784 / 86_400

export type PlanetState = {
  /** Geocentric position, km, mean equator and equinox of date (≈ TEME). */
  positionKm: Vec3
  /** Planet–Sun distance, au. */
  rAu: number
  /** Earth–planet distance, au. */
  deltaAu: number
  /** Sun–planet–Earth phase angle, degrees. */
  phaseDeg: number
  /** Apparent visual magnitude (see `planetMagnitude`). */
  magnitude: number
}

/**
 * Geocentric planet state. Light-time is applied once (the planet is seen
 * where it was ~Δ/c ago, up to ~80 min for Saturn). Aberration (≤ 20″) and
 * the Earth–Moon barycentre offset (≤ 25″ for Venus at its closest) are
 * neglected and documented.
 */
export function planetState(id: PlanetId, jdTt: number): PlanetState {
  const t = (jdTt - 2_451_545.0) / 36_525
  const earth = heliocentricAu('emb', t)
  let planet = heliocentricAu(id, t)
  const lightTimeDays = norm(sub(planet, earth)) * LIGHT_DAYS_PER_AU
  planet = heliocentricAu(id, t - lightTimeDays / 36_525)

  const geoEcl = sub(planet, earth)
  const rAu = norm(planet)
  const deltaAu = norm(geoEcl)
  const phaseDeg = angleBetween(scale(planet, -1), scale(geoEcl, -1)) * RAD

  const eqJ2000 = eclipticToEquatorial(geoEcl, EPS_J2000)
  const eqDate = precessFromJ2000(eqJ2000, t)
  // Saturnicentric latitude of Earth above the ring plane (for the ring term).
  const ringTiltRad =
    id === 'saturn' ? Math.asin(dot(SATURN_POLE_J2000, unit(scale(eqJ2000, -1)))) : 0
  return {
    positionKm: scale(eqDate, AU_KM),
    rAu,
    deltaAu,
    phaseDeg,
    magnitude: planetMagnitude(id, rAu, deltaAu, phaseDeg, ringTiltRad),
  }
}

/** Saturn's north pole, J2000 equatorial (IAU WGCCRE: α₀ = 40.589°, δ₀ = 83.537°). */
const SATURN_POLE_J2000: Vec3 = (() => {
  const ra = 40.589 * DEG
  const dec = 83.537 * DEG
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
})()

/**
 * Visual magnitude, Astronomical Almanac (1984) expressions as given in
 * Meeus, *Astronomical Algorithms* 2nd ed., ch. 41. For Saturn the 0.044
 * coefficient multiplies ΔU (Sun–Earth longitude difference seen from
 * Saturn), which we approximate by the phase angle (both ≤ ~6°). The ring
 * term −2.60·sin|B| + 1.25·sin²B uses B, Earth's latitude above the rings.
 */
export function planetMagnitude(
  id: PlanetId,
  r: number,
  delta: number,
  i: number,
  ringTiltRad = 0,
): number {
  const base = 5 * Math.log10(r * delta)
  switch (id) {
    case 'mercury':
      return -0.42 + base + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i
    case 'venus':
      return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i
    case 'mars':
      return -1.52 + base + 0.016 * i
    case 'jupiter':
      return -9.4 + base + 0.005 * i
    case 'saturn': {
      const sinB = Math.sin(Math.abs(ringTiltRad))
      return -8.88 + base + 0.044 * i - 2.6 * sinB + 1.25 * sinB * sinB
    }
  }
}

export const PLANETS: readonly PlanetId[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn']
