// Earth for Wave Back: Natural Earth land outlines and named seas (our own
// static file, loaded on the first flip), and "where is that?" in words.
// Learn: docs/learn/14-wave-back.md
import { centralAngleDeg, type LatLon } from '../../engine/sky/subpoint.ts'
import { compass8 } from '../../engine/describe/describe.ts'
import { shortLabel, type CityDb, type CityRow } from '../../lib/places.ts'

/** Rings are flat arrays in tenths of a degree: [lon0, lat0, lon1, lat1, …]. */
export type Earth = {
  land: number[][]
  seas: Array<{ name: string; rank: number; rings: number[][] }>
}

let cached: Promise<Earth> | null = null
export function loadEarth(): Promise<Earth> {
  cached ??= fetch('/data/earth-110m.json').then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Earth>
  })
  return cached
}

const KM_PER_DEG = 111.195

/** Even–odd point-in-polygon on a packed ring (lon/lat as a flat plane). */
export function inRing(ring: readonly number[], lonDeg: number, latDeg: number): boolean {
  const x = lonDeg * 10
  const y = latDeg * 10
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i]!
    const yi = ring[i + 1]!
    const xj = ring[j]!
    const yj = ring[j + 1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function isLand(earth: Earth, p: LatLon): boolean {
  return earth.land.some((r) => inRing(r, p.lonDeg, p.latDeg))
}

/** The most specific named sea or ocean containing a point (seas beat oceans). */
export function seaName(earth: Earth, p: LatLon): string | null {
  let best: { name: string; rank: number } | null = null
  for (const s of earth.seas)
    if (s.rings.some((r) => inRing(r, p.lonDeg, p.latDeg)) && (!best || s.rank > best.rank))
      best = s
  return best?.name ?? null
}

const COMPASS_WORDS: Record<string, string> = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest',
}

/** Initial bearing from a to b, degrees. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const D = Math.PI / 180
  const y = Math.sin((b.lonDeg - a.lonDeg) * D) * Math.cos(b.latDeg * D)
  const x =
    Math.cos(a.latDeg * D) * Math.sin(b.latDeg * D) -
    Math.sin(a.latDeg * D) * Math.cos(b.latDeg * D) * Math.cos((b.lonDeg - a.lonDeg) * D)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Nearest city with at least `minPop` people (bigger names read better from orbit). */
export function nearestNamed(db: CityDb, p: LatLon, minPop = 50_000): CityRow | null {
  let best: CityRow | null = null
  let bestD = Infinity
  for (const row of db.rows) {
    if (row[9] < minPop) continue
    const d = centralAngleDeg(p, { latDeg: row[5], lonDeg: row[6] })
    if (d < bestD) {
      bestD = d
      best = row
    }
  }
  return best
}

const round = (km: number) => (km < 100 ? Math.round(km / 10) * 10 : Math.round(km / 50) * 50)

/**
 * "above the North Pacific Ocean, 150 km off Monterey, CA", "right above
 * Bakersfield, CA", "300 km northeast of Reno, NV". Computed, never stock.
 */
export function describeGround(earth: Earth, db: CityDb | null, p: LatLon): string {
  const city = db ? nearestNamed(db, p) : null
  const cityKm = city
    ? centralAngleDeg(p, { latDeg: city[5], lonDeg: city[6] }) * KM_PER_DEG
    : Infinity
  const name = city ? shortLabel(city) : ''
  if (!isLand(earth, p)) {
    const sea = seaName(earth, p) ?? 'the open ocean'
    const where = sea.startsWith('the ') ? sea : `the ${sea}`
    return city && cityKm < 600
      ? `above ${where}, ${round(cityKm)} km off ${name}`
      : `above ${where}`
  }
  if (!city || cityKm > 1500) return 'above open land'
  if (cityKm < 40) return `right above ${name}`
  const dir = COMPASS_WORDS[compass8(bearingDeg({ latDeg: city[5], lonDeg: city[6] }, p))]
  return `${round(cityKm)} km ${dir} of ${name}`
}
