// What else is up tonight: the Moon and the bright planets.
// On nights without a good station pass, this is still a reason to look up.
// Learn: docs/learn/10-sky-objects.md
import { RAD } from '../math/constants.ts'
import { angleBetween, scale, sub } from '../math/vec.ts'
import { lookAtTeme, makeObserver } from '../frames/observer.ts'
import { moonPositionKm } from '../moon/moon.ts'
import { PLANETS, planetState, type PlanetId } from '../planets/planets.ts'
import type { Place } from '../place.ts'
import { DEFAULT_EOP, type EopTable } from '../time/scales.ts'
import { skyAt } from './sky.ts'

export type MoonInfo = {
  /** Illuminated fraction of the disc, 0–1. */
  illumination: number
  waxing: boolean
  azDeg: number
  elDeg: number
}

export type PlanetSighting = {
  id: PlanetId
  magnitude: number
  /** Where it is at the sampled moment of best placement in the window. */
  bestMs: number
  azDeg: number
  elDeg: number
}

/** The Moon as seen from `place` at `unixMs`. */
export function moonAt(place: Place, unixMs: number, eop: EopTable = DEFAULT_EOP): MoonInfo {
  const sky = skyAt(unixMs, eop)
  const moon = moonPositionKm(sky.jdTt)
  const look = lookAtTeme(makeObserver(place), moon, sky.gmstRad)
  // Phase angle at the Moon between the Sun and Earth.
  const phase = angleBetween(sub(sky.sunTeme, moon), scale(moon, -1))
  // Waxing while the Moon is east of the Sun (elongation measured eastward < 180°).
  const sunLon = Math.atan2(sky.sunTeme[1], sky.sunTeme[0])
  const moonLon = Math.atan2(moon[1], moon[0])
  const east = ((((moonLon - sunLon) * RAD) % 360) + 360) % 360
  return {
    illumination: (1 + Math.cos(phase)) / 2,
    waxing: east < 180,
    azDeg: look.azDeg,
    elDeg: look.elDeg,
  }
}

/**
 * Planets that are naked-eye visible (mag ≤ 2) and at least `minElDeg` high
 * at some point in [fromMs, toMs], sampled every 15 minutes.
 * We report the moment each is highest within the window.
 */
export function planetsVisible(
  place: Place,
  fromMs: number,
  toMs: number,
  minElDeg = 10,
  eop: EopTable = DEFAULT_EOP,
): PlanetSighting[] {
  const observer = makeObserver(place)
  const out: PlanetSighting[] = []
  for (const id of PLANETS) {
    let best: PlanetSighting | null = null
    for (let t = fromMs; t <= toMs; t += 15 * 60_000) {
      const sky = skyAt(t, eop)
      const st = planetState(id, sky.jdTt)
      const look = lookAtTeme(observer, st.positionKm, sky.gmstRad)
      if (look.elDeg >= minElDeg && st.magnitude <= 2 && (!best || look.elDeg > best.elDeg)) {
        best = { id, magnitude: st.magnitude, bestMs: t, azDeg: look.azDeg, elDeg: look.elDeg }
      }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => a.magnitude - b.magnitude)
}
