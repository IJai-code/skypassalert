// @vitest-environment node
import { jdUtc, mjdUtc, unixMsFromJdUtc } from './julian.ts'
import { jdTt, taiMinusUtc, ttMinusUtc, ut1MinusUtc, type EopTable } from './scales.ts'
import { gmst82 } from './sidereal.ts'
import { RAD } from '../math/constants.ts'

describe('Julian dates', () => {
  it('J2000.0 is JD 2451545.0 at 2000-01-01 12:00 UTC', () => {
    expect(jdUtc(Date.parse('2000-01-01T12:00:00Z'))).toBe(2_451_545.0)
  })
  it('round-trips through Unix ms to sub-millisecond precision', () => {
    const t = Date.parse('2026-10-25T02:36:06.123Z')
    expect(Math.abs(unixMsFromJdUtc(jdUtc(t)) - t)).toBeLessThan(0.1)
  })
  it('MJD is JD − 2400000.5', () => {
    expect(mjdUtc(Date.parse('1858-11-17T00:00:00Z'))).toBeCloseTo(0, 9)
  })
})

describe('time scales', () => {
  it('applies the 2016-12-31 leap second', () => {
    expect(taiMinusUtc(Date.parse('2016-12-31T23:59:59Z'))).toBe(36)
    expect(taiMinusUtc(Date.parse('2017-01-01T00:00:00Z'))).toBe(37)
  })
  it('TT − UTC is 69.184 s today', () => {
    expect(ttMinusUtc(Date.parse('2026-10-24T00:00:00Z'))).toBeCloseTo(69.184, 9)
    const t = Date.parse('2026-10-24T00:00:00Z')
    expect((jdTt(t) - jdUtc(t)) * 86_400).toBeCloseTo(69.184, 3)
  })

  const eop: EopTable = { source: 'test', startMjd: 61_000, dut1: [0.1, 0.2, -0.75, 0.25] }
  const mjdToMs = (mjd: number) => (mjd + 2_400_000.5 - 2_440_587.5) * 86_400_000
  it('interpolates UT1 − UTC linearly between days', () => {
    expect(ut1MinusUtc(mjdToMs(61_000.5), eop).seconds).toBeCloseTo(0.15, 9)
  })
  it('does not interpolate across a leap-second jump', () => {
    // −0.75 → +0.25 is a +1 s jump: take the nearest side instead of a fake average.
    expect(ut1MinusUtc(mjdToMs(61_002.4), eop).seconds).toBe(-0.75)
    expect(ut1MinusUtc(mjdToMs(61_002.6), eop).seconds).toBe(0.25)
  })
  it('holds the end value outside the table and says so', () => {
    expect(ut1MinusUtc(mjdToMs(60_000), eop)).toEqual({ seconds: 0.1, inRange: false })
    expect(ut1MinusUtc(mjdToMs(62_000), eop)).toEqual({ seconds: 0.25, inRange: false })
  })
  it('bundled IERS table covers the launch season', () => {
    expect(ut1MinusUtc(Date.parse('2026-12-01T00:00:00Z')).inRange).toBe(true)
  })
})

describe('GMST (IAU 1982)', () => {
  it('matches the defining value at J2000.0: 280.46061837°', () => {
    expect(gmst82(2_451_545.0) * RAD).toBeCloseTo(280.46061837, 6)
  })
  it('gains ~3 min 56 s on the clock per day (one extra turn per year)', () => {
    const d = (gmst82(2_451_546.0) - gmst82(2_451_545.0)) * RAD
    expect(d).toBeCloseTo(0.98564736, 6)
  })
})
