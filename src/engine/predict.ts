// The engine's front door: everything the app shows for one place.
// Runs in a Web Worker in the browser and in Node for build-time pages.
// Learn: docs/learn/05-passes.md#forecast
import { findPasses, type PassOptions, type VisiblePass } from './passes/finder.ts'
import { satelliteJsPropagator } from './propagate/satellitejs-adapter.ts'
import { epochToUnixMs, type OmmElements, type Propagator } from './propagate/propagator.ts'
import type { Place } from './place.ts'
import { eveningFor, type Evening } from './sky/sunEvents.ts'
import { moonAt, planetsVisible, type MoonInfo, type PlanetSighting } from './sky/tonight.ts'
import { stationView, type StationView } from './sky/subpoint.ts'
import { showersTonight, type ShowerTonight } from './meteors/meteors.ts'
import { addDays, localDateKey, parseDateKey, zonedTimeToUnixMs } from './time/zone.ts'
import { DEFAULT_EOP, type EopTable } from './time/scales.ts'

export type ElementsInfo = {
  noradId: number
  name: string
  epochMs: number
}

export type NightSky = {
  evening: Evening
  /** The Moon one hour after the end of civil twilight (or 21:00 local). */
  moon: MoonInfo
  /** Bright planets between civil dusk and local midnight. */
  planets: PlanetSighting[]
  /** Active meteor showers worth a look, best first. */
  meteors: ShowerTonight[]
}

/**
 * A visible pass plus where the Moon is at its peak (for the sky map) and
 * where the station is above Earth around it (for Wave Back).
 */
export type ForecastPass = VisiblePass & { moonAtPeak: MoonInfo; station: StationView }

const STATION_MARGIN_MS = 10 * 60_000

export type Forecast = {
  place: Place
  fromMs: number
  toMs: number
  propagatorId: string
  elements: ElementsInfo[]
  passes: ForecastPass[]
  nights: NightSky[]
}

export type ForecastRequest = {
  place: Place
  elements: readonly OmmElements[]
  fromMs: number
  days?: number
  passOptions?: Partial<PassOptions>
  eop?: EopTable
  propagator?: Propagator
}

export function forecast(req: ForecastRequest): Forecast {
  const days = req.days ?? 7
  const eop = req.eop ?? DEFAULT_EOP
  const propagator = req.propagator ?? satelliteJsPropagator
  const toMs = req.fromMs + days * 86_400_000

  const passes: Array<VisiblePass & { station: StationView }> = []
  const elements: ElementsInfo[] = []
  for (const el of req.elements) {
    elements.push({
      noradId: el.NORAD_CAT_ID,
      name: el.OBJECT_NAME,
      epochMs: epochToUnixMs(el.EPOCH),
    })
    const sat = propagator.init(el)
    for (const p of findPasses(sat, req.place, req.fromMs, toMs, { ...req.passOptions, eop })) {
      // Ten minutes either side: enough ground track to cross the globe view.
      const from = p.start.unixMs - STATION_MARGIN_MS
      const to = p.end.unixMs + STATION_MARGIN_MS
      passes.push({ ...p, station: stationView(sat, from, to, p.peak.unixMs, 30_000, eop) })
    }
  }
  passes.sort((a, b) => a.start.unixMs - b.start.unixMs)
  const withMoon: ForecastPass[] = passes.map((p) => ({
    ...p,
    moonAtPeak: moonAt(req.place, p.peak.unixMs, eop),
  }))

  const tz = req.place.timeZone
  const firstKey = localDateKey(req.fromMs, tz)
  const nights: NightSky[] = []
  for (let i = 0; i < days; i++) {
    const key = addDays(firstKey, i)
    const evening = eveningFor(req.place, key, eop)
    const duskish = evening.civilDuskMs ?? zonedTimeToUnixMs(tz, ...parseDateKey(key), 21)
    const midnight = zonedTimeToUnixMs(tz, ...parseDateKey(addDays(key, 1)), 0)
    nights.push({
      evening,
      moon: moonAt(req.place, duskish + 3_600_000, eop),
      planets: planetsVisible(req.place, duskish, Math.max(midnight, duskish + 3_600_000), 10, eop),
      meteors: showersTonight(req.place, evening, eop),
    })
  }

  return {
    place: req.place,
    fromMs: req.fromMs,
    toMs,
    propagatorId: propagator.id,
    elements,
    passes: withMoon,
    nights,
  }
}
