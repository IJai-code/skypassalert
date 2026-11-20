// One night as a list of stops in time order: sunset, first stars, every
// visible pass, the Moon, the planets at their best, sunrise. The Tonight tab
// sets them as a ruled table, one line per stop.
// Docs: docs/DESIGN.md#almanac
import type {
  Forecast,
  ForecastPass,
  MoonInfo,
  NightSky,
  PlanetSighting,
} from '../../engine/index.ts'
import { passPeriod, passScore } from '../../engine/sky/schedule.ts'
import { WORTH_IT } from '../../lib/state.ts'
import { postcardView } from '../stageView.ts'

export type Face = { azDeg: number; elDeg: number }

export type Stop =
  | { kind: 'sunset'; id: string; atMs: number; face: Face }
  | { kind: 'dark'; id: string; atMs: number; face: Face }
  | {
      kind: 'pass'
      id: string
      atMs: number
      face: Face
      pass: ForecastPass
      /** Before dawn: for early risers. */
      dawn: boolean
      /** Low or faint: listed, not worth a special trip. */
      weak: boolean
    }
  | { kind: 'moon'; id: string; atMs: number; face: Face; moon: MoonInfo }
  | { kind: 'planet'; id: string; atMs: number; face: Face; planet: PlanetSighting }
  | { kind: 'sunrise'; id: string; atMs: number; face: Face }

export type Night = {
  night: NightSky
  startMs: number
  endMs: number
  stops: Stop[]
}

const HOUR = 3_600_000
/** Planets and the Moon are framed a little higher than they sit, so the ground stays in view. */
const LOOK_UP = 22

export const passKey = (p: { noradId: number; start: { unixMs: number } }) =>
  `${p.noradId}-${p.start.unixMs}`

/**
 * The night to show: the one containing `anchorMs` (a pass the user picked)
 * or, by default, the first night whose sunrise is still ahead.
 */
export function pickNight(forecast: Forecast, nowMs: number, anchorMs?: number): NightSky | null {
  const t = anchorMs ?? nowMs
  const ends = (n: NightSky) => n.evening.sunriseMs ?? noonAfter(n)
  return forecast.nights.find((n) => ends(n) > t) ?? null
}

function noonAfter(n: NightSky): number {
  return (n.evening.sunsetMs ?? n.evening.civilDuskMs ?? 0) + 14 * HOUR
}

export function buildNight(forecast: Forecast, nowMs: number, anchorMs?: number): Night | null {
  const night = pickNight(forecast, nowMs, anchorMs)
  if (!night) return null
  const ev = night.evening
  const tz = forecast.place.timeZone
  const dusk = ev.sunsetMs ?? ev.civilDuskMs ?? nowMs
  // Start an hour before sunset, or now if the night has already begun.
  const startMs = Math.max(dusk - HOUR, nowMs)
  const endMs = ev.sunriseMs ?? noonAfter(night)
  const sunsetAz = ev.sunsetAzDeg ?? 270
  // Sunrise mirrors sunset across the north–south line (to within a degree
  // or two over one night).
  const sunriseAz = (360 - sunsetAz) % 360
  const within = (t: number) => t >= startMs && t <= endMs

  const stops: Stop[] = []
  if (ev.sunsetMs !== null && ev.sunsetMs > startMs)
    stops.push({
      kind: 'sunset',
      id: 'sunset',
      atMs: ev.sunsetMs,
      face: { azDeg: sunsetAz, elDeg: 12 },
    })
  if (ev.civilDuskMs !== null && ev.civilDuskMs > startMs)
    stops.push({
      kind: 'dark',
      id: 'dark',
      atMs: ev.civilDuskMs,
      face: { azDeg: (sunsetAz + 180) % 360, elDeg: 35 },
    })

  for (const p of forecast.passes) {
    if (!within(p.start.unixMs) && !within(p.end.unixMs)) continue
    stops.push({
      kind: 'pass',
      id: passKey(p),
      atMs: p.start.unixMs,
      face: { azDeg: postcardView(p).az, elDeg: 18 },
      pass: p,
      dawn: passPeriod(p, tz) === 'before-dawn',
      weak: passScore(p) < WORTH_IT,
    })
  }

  // The Moon, an hour after dusk, if it is up and more than a sliver.
  const moonMs = (ev.civilDuskMs ?? dusk) + HOUR
  if (night.moon.elDeg > 5 && night.moon.illumination > 0.04 && within(moonMs))
    stops.push({
      kind: 'moon',
      id: 'moon',
      atMs: moonMs,
      face: { azDeg: night.moon.azDeg, elDeg: Math.min(60, night.moon.elDeg + LOOK_UP / 2) },
      moon: night.moon,
    })

  for (const pl of night.planets) {
    if (!within(pl.bestMs)) continue
    stops.push({
      kind: 'planet',
      id: pl.id,
      atMs: pl.bestMs,
      face: { azDeg: pl.azDeg, elDeg: Math.min(60, pl.elDeg + LOOK_UP / 2) },
      planet: pl,
    })
  }

  if (ev.sunriseMs !== null)
    stops.push({
      kind: 'sunrise',
      id: 'sunrise',
      atMs: ev.sunriseMs,
      face: { azDeg: sunriseAz, elDeg: 12 },
    })

  stops.sort((a, b) => a.atMs - b.atMs)
  return { night, startMs, endMs, stops }
}

/**
 * How long a stop's own stretch of time lasts on the scroll: a pass scrubs
 * from first sight to last, everything else is one moment.
 */
export function stopSpan(s: Stop): [number, number] {
  return s.kind === 'pass' ? [s.pass.start.unixMs, s.pass.end.unixMs] : [s.atMs, s.atMs]
}
