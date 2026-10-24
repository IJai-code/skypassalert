// Time scales: UTC → TAI → TT, and UTC → UT1.
// Learn: docs/learn/01-time.md
//
// UTC is what clocks show. It stays within 0.9 s of UT1 (Earth's actual
// rotation angle) by inserting leap seconds. TT is the smooth physics time
// used by the Sun, Moon and planet formulas: TT = TAI + 32.184 s.
// Mixing them up is not a rounding error: the Earth turns ~0.46 km per second
// at the equator, so 1 s of UT1 error moves the observer by ~0.4 km.
import { MJD_OFFSET, SECONDS_PER_DAY } from '../math/constants.ts'
import { jdUtc, mjdUtc } from './julian.ts'
import defaultEop from './eop-data.json'

/** [Unix ms when it takes effect, TAI − UTC in seconds]. IERS Bulletin C. */
const LEAP_SECONDS: ReadonlyArray<readonly [number, number]> = [
  ['1972-01-01', 10],
  ['1972-07-01', 11],
  ['1973-01-01', 12],
  ['1974-01-01', 13],
  ['1975-01-01', 14],
  ['1976-01-01', 15],
  ['1977-01-01', 16],
  ['1978-01-01', 17],
  ['1979-01-01', 18],
  ['1980-01-01', 19],
  ['1981-07-01', 20],
  ['1982-07-01', 21],
  ['1983-07-01', 22],
  ['1985-07-01', 23],
  ['1988-01-01', 24],
  ['1990-01-01', 25],
  ['1991-01-01', 26],
  ['1992-07-01', 27],
  ['1993-07-01', 28],
  ['1994-07-01', 29],
  ['1996-01-01', 30],
  ['1997-07-01', 31],
  ['1999-01-01', 32],
  ['2006-01-01', 33],
  ['2009-01-01', 34],
  ['2012-07-01', 35],
  ['2015-07-01', 36],
  ['2017-01-01', 37],
].map(([date, dat]) => [Date.parse(`${date}T00:00:00Z`), dat as number] as const)

/** TAI − UTC, seconds. Before 1972 we clamp to 10 s (not used by this app). */
export function taiMinusUtc(unixMs: number): number {
  let dat = 10
  for (const [start, value] of LEAP_SECONDS) {
    if (unixMs >= start) dat = value
    else break
  }
  return dat
}

/** TT − UTC, seconds. */
export function ttMinusUtc(unixMs: number): number {
  return taiMinusUtc(unixMs) + 32.184
}

/** Julian date on the TT scale. */
export function jdTt(unixMs: number): number {
  return jdUtc(unixMs) + ttMinusUtc(unixMs) / SECONDS_PER_DAY
}

/**
 * Daily UT1 − UTC values (IERS, via CelesTrak's EOP file).
 * `startMjd` is the MJD of the first value; one value per day after that.
 */
export type EopTable = {
  source: string
  startMjd: number
  dut1: readonly number[]
}

export const DEFAULT_EOP: EopTable = defaultEop

/**
 * UT1 − UTC in seconds, linearly interpolated between daily values.
 * Outside the table we hold the nearest value: UT1 − UTC drifts by
 * roughly 1–2 ms/day, so even a month past the end the error is ~0.05 s
 * (~20 m of Earth rotation at the equator). `inRange` lets callers say so.
 */
export function ut1MinusUtc(
  unixMs: number,
  eop: EopTable = DEFAULT_EOP,
): { seconds: number; inRange: boolean } {
  const x = mjdUtc(unixMs) - eop.startMjd
  const last = eop.dut1.length - 1
  if (last < 0) return { seconds: 0, inRange: false }
  if (x <= 0) return { seconds: eop.dut1[0] ?? 0, inRange: x === 0 }
  if (x >= last) return { seconds: eop.dut1[last] ?? 0, inRange: x === last }
  const i = Math.floor(x)
  const f = x - i
  const a = eop.dut1[i] ?? 0
  const b = eop.dut1[i + 1] ?? a
  // Skip interpolation across a leap second (UT1 − UTC jumps by +1 s).
  if (Math.abs(b - a) > 0.5) return { seconds: f < 0.5 ? a : b, inRange: true }
  return { seconds: a + f * (b - a), inRange: true }
}

/** Julian date on the UT1 scale. */
export function jdUt1(unixMs: number, eop: EopTable = DEFAULT_EOP): number {
  return jdUtc(unixMs) + ut1MinusUtc(unixMs, eop).seconds / SECONDS_PER_DAY
}

export { MJD_OFFSET }
