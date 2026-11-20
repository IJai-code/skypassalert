// Which meteor showers are worth a look tonight, and roughly how many
// meteors an hour you might see. The answer is honest about how rough it is:
// rates swing a lot from year to year and minute to minute.
//
//   seen per hour ≈ ZHR(Δλ) × sin(radiant altitude) × moonlight factor
//
// ZHR is the rate under a perfect sky with the radiant overhead; the sine
// accounts for a radiant lower in the sky, and a bright Moon washes out the
// fainter meteors. ZHR assumes a perfect sky, so that figure is the top of
// the range and 30% of it the bottom; towns see far fewer.
// Learn: docs/learn/15-meteors.md
import { DEG, RAD } from '../math/constants.ts'
import type { Vec3 } from '../math/vec.ts'
import type { Place } from '../place.ts'
import type { Evening } from '../sky/sunEvents.ts'
import { directionToAzEl } from '../sky/scene.ts'
import { skyAt } from '../sky/sky.ts'
import { moonAt, type MoonInfo } from '../sky/tonight.ts'
import { parseDateKey } from '../time/zone.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { SHOWERS, type Shower, type ShowerId } from './showers.ts'

export type ShowerTonight = {
  id: ShowerId
  name: string
  /** Days from tonight to the peak; negative after it. Rounded to whole days. */
  peakInDays: number
  /** The best hour in full dark: radiant high, Moon down if it can be. */
  bestMs: number
  radiantAzDeg: number
  radiantElDeg: number
  /** Moon lit fraction, and whether it's still up at `bestMs`. */
  moonIllumination: number
  moonUp: boolean
  /** Meteors an hour from a dark spot, as a range. */
  rateLow: number
  rateHigh: number
  speedKms: number
}

const OBLIQUITY = 23.4393 * DEG
/** Below this the radiant is too low for a shower to be worth suggesting. */
const MIN_RADIANT_EL = 10
/** Below this many an hour at best, a shower isn't a reason to go out. */
const MIN_RATE = 3
const SAMPLE_MS = 15 * 60_000

/** The Sun's ecliptic longitude, degrees: the calendar meteor showers follow. */
export function solarLongitudeDeg(unixMs: number, eop: EopTable = DEFAULT_EOP): number {
  const s = skyAt(unixMs, eop).sunTeme
  const lon = Math.atan2(s[1] * Math.cos(OBLIQUITY) + s[2] * Math.sin(OBLIQUITY), s[0]) * RAD
  return (lon + 360) % 360
}

/** Signed difference a − b on a circle, in (−180, 180]. */
const circDiff = (a: number, b: number) => ((((a - b + 180) % 360) + 360) % 360) - 180

/** Is the local date inside the shower's active window (which may wrap the year)? */
export function isActive(s: Shower, month: number, day: number): boolean {
  const md = month * 100 + day
  const from = s.from[0] * 100 + s.from[1]
  const to = s.to[0] * 100 + s.to[1]
  return from <= to ? md >= from && md <= to : md >= from || md <= to
}

function radiantVec(s: Shower): Vec3 {
  const ra = s.raDeg * DEG
  const dec = s.decDeg * DEG
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

/**
 * Bright moonlight hides the faint majority of meteors. A full Moon above the
 * horizon cuts what you'll see to about a third; a crescent barely matters.
 */
export function moonFactor(illumination: number, moonUp: boolean): number {
  return moonUp ? 1 - 0.65 * illumination : 1
}

export function showersTonight(
  place: Place,
  evening: Evening,
  eop: EopTable = DEFAULT_EOP,
): ShowerTonight[] {
  const [, month, day] = parseDateKey(evening.dateKey)
  const darkFrom = evening.astronomicalDuskMs ?? evening.nauticalDuskMs ?? evening.civilDuskMs
  const darkTo = evening.civilDawnMs ?? evening.sunriseMs
  if (darkFrom === null || darkTo === null || darkTo <= darkFrom) return []

  const active = SHOWERS.filter((s) => isActive(s, month, day))
  if (!active.length) return []

  // Sky geometry for the night, shared by every shower.
  const samples: Array<{ ms: number; gmst: number; moon: MoonInfo }> = []
  for (let t = darkFrom; t <= darkTo; t += SAMPLE_MS)
    samples.push({ ms: t, gmst: skyAt(t, eop).gmstRad, moon: moonAt(place, t, eop) })
  const lambda = solarLongitudeDeg((darkFrom + darkTo) / 2, eop)

  const out: ShowerTonight[] = []
  for (const s of active) {
    const dir = radiantVec(s)
    // The best hour balances a high radiant against the Moon being up.
    let best: { ms: number; azDeg: number; elDeg: number; seen: number; moon: MoonInfo } | null =
      null
    for (const { ms, gmst, moon } of samples) {
      const look = directionToAzEl(dir, gmst, place.latDeg, place.lonDeg)
      if (look.elDeg < MIN_RADIANT_EL) continue
      const seen = Math.sin(look.elDeg * DEG) * moonFactor(moon.illumination, moon.elDeg > 0)
      if (!best || seen > best.seen) best = { ms, ...look, seen, moon }
    }
    if (!best) continue

    const dLambda = circDiff(s.peakSolarLonDeg, lambda)
    const zhr = s.zhr * 10 ** (-s.slope * Math.abs(dLambda))
    const rate = zhr * best.seen
    if (rate < MIN_RATE) continue
    const moonUp = best.moon.elDeg > 0
    const moon = best.moon

    out.push({
      id: s.id,
      name: s.name,
      // The Sun moves ~0.9856° of longitude a day.
      peakInDays: Math.round(dLambda / 0.9856),
      bestMs: best.ms,
      radiantAzDeg: best.azDeg,
      radiantElDeg: best.elDeg,
      moonIllumination: moon.illumination,
      moonUp,
      // ZHR assumes a perfect sky (stars to magnitude 6.5). Even a good dark
      // spot falls short, so the ideal figure is the top of the range.
      rateLow: Math.max(1, Math.round(rate * 0.3)),
      rateHigh: Math.round(rate),
      speedKms: s.speedKms,
    })
  }
  return out.sort((a, b) => b.rateHigh - a.rateHigh)
}
