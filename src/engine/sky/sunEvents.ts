// Sunset, twilight and sunrise for a local calendar evening.
// Learn: docs/learn/03-sun.md#events
import { brentRoot } from '../math/roots.ts'
import { makeObserver } from '../frames/observer.ts'
import type { Place } from '../place.ts'
import { addDays, parseDateKey, zonedTimeToUnixMs } from '../time/zone.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { skyAt, sunLook } from './sky.ts'

/**
 * Altitudes (degrees, Sun's centre, geometric) that define each event.
 * Sunset uses −0.833°: 34′ of refraction at the horizon plus the Sun's 16′ radius.
 */
export const SUN_ALTITUDE = {
  sunset: -0.833,
  civil: -6,
  nautical: -12,
  astronomical: -18,
} as const

export type Evening = {
  /** Local date the evening belongs to, "YYYY-MM-DD". */
  dateKey: string
  sunsetMs: number | null
  sunsetAzDeg: number | null
  civilDuskMs: number | null
  nauticalDuskMs: number | null
  astronomicalDuskMs: number | null
  /** Next morning. */
  civilDawnMs: number | null
  sunriseMs: number | null
}

/**
 * Sun events from local noon on `dateKey` to local noon the next day.
 * Returns nulls where the Sun never crosses an altitude (polar day/night,
 * or Reykjavík in June, when it never gets darker than civil twilight).
 */
export function eveningFor(place: Place, dateKey: string, eop: EopTable = DEFAULT_EOP): Evening {
  const noon = zonedTimeToUnixMs(place.timeZone, ...parseDateKey(dateKey), 12)
  const nextNoon = zonedTimeToUnixMs(place.timeZone, ...parseDateKey(addDays(dateKey, 1)), 12)
  const observer = makeObserver(place)
  const alt = (t: number) => sunLook(observer, skyAt(t, eop)).elDeg

  // Sample every 10 min; each crossing is then refined to 1 s.
  const step = 10 * 60_000
  const samples: Array<[number, number]> = []
  for (let t = noon; t <= nextNoon; t += step) samples.push([t, alt(t)])

  const crossing = (target: number, direction: 'down' | 'up'): number | null => {
    for (let i = 1; i < samples.length; i++) {
      const [t0, a0] = samples[i - 1] as [number, number]
      const [t1, a1] = samples[i] as [number, number]
      const down = a0 > target && a1 <= target
      const up = a0 <= target && a1 > target
      if ((direction === 'down' && down) || (direction === 'up' && up)) {
        return brentRoot((t) => alt(t) - target, t0, t1, 1000)
      }
    }
    return null
  }

  const sunsetMs = crossing(SUN_ALTITUDE.sunset, 'down')
  return {
    dateKey,
    sunsetMs,
    sunsetAzDeg: sunsetMs === null ? null : sunLook(observer, skyAt(sunsetMs, eop)).azDeg,
    civilDuskMs: crossing(SUN_ALTITUDE.civil, 'down'),
    nauticalDuskMs: crossing(SUN_ALTITUDE.nautical, 'down'),
    astronomicalDuskMs: crossing(SUN_ALTITUDE.astronomical, 'down'),
    civilDawnMs: crossing(SUN_ALTITUDE.civil, 'up'),
    sunriseMs: crossing(SUN_ALTITUDE.sunset, 'up'),
  }
}
