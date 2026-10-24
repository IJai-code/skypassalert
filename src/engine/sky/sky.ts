// Per-instant sky geometry shared by the pass finder and the "tonight" view:
// time scales, Earth's rotation angle, and where the Sun is.
// Learn: docs/learn/03-sun.md
import { gmst82 } from '../time/sidereal.ts'
import { jdTt, jdUt1, type EopTable, DEFAULT_EOP } from '../time/scales.ts'
import { sunPositionKm } from '../sun/sun.ts'
import { lookAtTeme, type Observer } from '../frames/observer.ts'
import type { LookAngles } from '../frames/frames.ts'
import type { Vec3 } from '../math/vec.ts'

export type SkyInstant = {
  unixMs: number
  jdTt: number
  gmstRad: number
  /** Geocentric Sun, km, mean-of-date ≈ TEME. */
  sunTeme: Vec3
}

export function skyAt(unixMs: number, eop: EopTable = DEFAULT_EOP): SkyInstant {
  const tt = jdTt(unixMs)
  return {
    unixMs,
    jdTt: tt,
    gmstRad: gmst82(jdUt1(unixMs, eop)),
    sunTeme: sunPositionKm(tt),
  }
}

/** The Sun as seen by the observer (geometric centre, no refraction). */
export function sunLook(observer: Observer, sky: SkyInstant): LookAngles {
  return lookAtTeme(observer, sky.sunTeme, sky.gmstRad)
}
