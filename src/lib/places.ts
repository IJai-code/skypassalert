// Places: choosing where you are, privately. City search runs on a bundled
// GeoNames list (no geocoding service); "Use my location" keeps the
// coordinates on the device and only names the nearest city.
import type { Place } from '../engine/place.ts'
import { DEFAULT_PLACE } from '../presets.ts'

export type CityRow = [
  geonameId: number,
  name: string,
  asciiName: string | 0,
  region: string,
  country: string,
  lat: number,
  lon: number,
  elevationM: number,
  zone: number,
  population: number,
]
export type CityDb = { source: string; zones: string[]; rows: CityRow[] }

let cached: Promise<CityDb> | null = null
export function loadCities(): Promise<CityDb> {
  cached ??= fetch('/data/cities.json').then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<CityDb>
  })
  return cached
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function cityLabel(row: CityRow): string {
  return row[4] === 'US'
    ? `${row[1]}, ${row[3]}`
    : row[3]
      ? `${row[1]}, ${row[3]}, ${row[4]}`
      : `${row[1]}, ${row[4]}`
}

/** Short name for headers: "Fremont, CA" in the US, "Sydney, AU" elsewhere. */
export function shortLabel(row: CityRow): string {
  return row[4] === 'US' ? `${row[1]}, ${row[3]}` : `${row[1]}, ${row[4]}`
}

export function placeFromCity(db: CityDb, row: CityRow): Place {
  return {
    id: `gn-${row[0]}`,
    name: shortLabel(row),
    latDeg: row[5],
    lonDeg: row[6],
    elevationM: row[7],
    timeZone: db.zones[row[8]] ?? 'UTC',
  }
}

/** Prefix matches first, then word matches, biggest cities first. "fremont ca" works. */
export function searchCities(db: CityDb, query: string, limit = 8): CityRow[] {
  const q = fold(query.replace(/,/g, ' '))
  if (q.length < 2) return []
  const [head = '', ...rest] = q.split(/\s+/)
  const tail = rest.join(' ')
  const scored: Array<[number, CityRow]> = []
  for (const row of db.rows) {
    const name = fold(String(row[2] || row[1]))
    let score: number
    if (name === q || name === head) score = 0
    else if (name.startsWith(q) || name.startsWith(head)) score = 1
    else if (name.includes(` ${head}`)) score = 2
    else continue
    if (tail) {
      const where = fold(`${row[3]} ${row[4]}`)
      if (!where.includes(tail) && !name.includes(tail)) continue
    }
    scored.push([score, row])
  }
  scored.sort((a, b) => a[0] - b[0] || b[1][9] - a[1][9])
  return scored.slice(0, limit).map(([, r]) => r)
}

/** The nearest listed city to a point (for naming a GPS position). */
export function nearestCity(db: CityDb, lat: number, lon: number): CityRow | null {
  let best: CityRow | null = null
  let bestD = Infinity
  const cosLat = Math.cos((lat * Math.PI) / 180)
  for (const row of db.rows) {
    const dx = (row[6] - lon) * cosLat
    const dy = row[5] - lat
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = row
    }
  }
  return best
}

/** A GPS fix as a Place: coordinates rounded to ~100 m, named after the nearest city. */
export function placeFromPosition(
  db: CityDb,
  lat: number,
  lon: number,
  elevationM: number | null,
): Place {
  const near = nearestCity(db, lat, lon)
  const rLat = Math.round(lat * 1000) / 1000
  const rLon = Math.round(lon * 1000) / 1000
  return {
    id: `geo-${rLat}-${rLon}`,
    name: near ? `Near ${shortLabel(near)}` : 'My location',
    latDeg: rLat,
    lonDeg: rLon,
    elevationM: elevationM ?? near?.[7] ?? 0,
    timeZone: near
      ? (db.zones[near[8]] ?? 'UTC')
      : Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

const KEY = 'spa:place'
export function loadSavedPlace(): Place {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Place
      if (typeof p.latDeg === 'number' && typeof p.lonDeg === 'number' && p.timeZone) return p
    }
  } catch {
    // private mode or bad data: fall back to the default
  }
  return DEFAULT_PLACE
}
export function savePlace(p: Place): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

export const BAY_AREA_PICKS = [
  5350734, 5392171, 5391959, 5378538, 5380748, 5400075, 5393015, 5341145, 5373327, 5355933, 5383777,
  5404555, 5376803,
]
