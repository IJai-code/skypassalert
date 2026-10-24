// The observer: a Place turned into the geometry the look-angle math needs.
// Learn: docs/learn/02-frames.md#observer
import type { Place } from '../place.ts'
import type { Vec3 } from '../math/vec.ts'
import { geodeticToEcef, lookAngles, temeToEcef, type LookAngles } from './frames.ts'

export type Observer = {
  place: Place
  ecef: Vec3
}

export function makeObserver(place: Place): Observer {
  return { place, ecef: geodeticToEcef(place.latDeg, place.lonDeg, place.elevationM / 1000) }
}

/** Look angles to a target given in TEME / mean-of-date km at sidereal angle `gmst`. */
export function lookAtTeme(observer: Observer, rTeme: Vec3, gmstRad: number): LookAngles {
  return lookAngles(
    observer.ecef,
    observer.place.latDeg,
    observer.place.lonDeg,
    temeToEcef(rTeme, gmstRad),
  )
}
