// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  centralAngleDeg,
  stationView,
  subpoint,
  subsolarPoint,
  sunElevationAt,
} from './subpoint.ts'
import { skyAt } from './sky.ts'
import { satelliteJsPropagator } from '../propagate/satellitejs-adapter.ts'
import type { OmmElements } from '../propagate/propagator.ts'
import elements from '../__fixtures__/stations-2026-10-24.json'

const iss = satelliteJsPropagator.init(
  (elements as OmmElements[]).find((e) => e.NORAD_CAT_ID === 25544)!,
)

describe('subsolar point', () => {
  it('sits on the equator at the March equinox and the tropic at the June solstice', () => {
    // 2027-03-20 20:25 UTC equinox; 2026-06-21 08:24 UTC solstice.
    expect(Math.abs(subsolarPoint(Date.UTC(2027, 2, 20, 20, 25)).latDeg)).toBeLessThan(0.05)
    expect(subsolarPoint(Date.UTC(2026, 5, 21, 8, 24)).latDeg).toBeCloseTo(23.44, 1)
  })

  it('is near Greenwich longitude at 12:00 UTC (within the equation of time)', () => {
    const lon = subsolarPoint(Date.UTC(2026, 10, 2, 12)).lonDeg
    // Early November the Sun runs ~16 min fast: noon at Greenwich was at
    // 11:44 UTC, so by 12:00 the Sun is overhead ~4° west of 0°.
    expect(lon).toBeLessThan(-2)
    expect(lon).toBeGreaterThan(-6)
  })
})

describe('geometry helpers', () => {
  it('measures great-circle angles', () => {
    expect(centralAngleDeg({ latDeg: 0, lonDeg: 0 }, { latDeg: 0, lonDeg: 90 })).toBeCloseTo(90)
    expect(centralAngleDeg({ latDeg: 90, lonDeg: 0 }, { latDeg: -90, lonDeg: 10 })).toBeCloseTo(180)
  })
  it('puts the Sun overhead at the subsolar point and on the horizon 90° away', () => {
    const ss = { latDeg: 10, lonDeg: 20 }
    expect(sunElevationAt(ss, ss)).toBeCloseTo(90)
    expect(sunElevationAt({ latDeg: 10, lonDeg: 110 }, { latDeg: 0, lonDeg: 20 })).toBeCloseTo(0, 0)
  })
})

describe('station view', () => {
  it('keeps the ISS near 400 km and within its 51.6° inclination', () => {
    const t0 = Date.UTC(2026, 9, 24, 12)
    const v = stationView(iss, t0, t0 + 90 * 60_000, t0)
    expect(v.samples).toHaveLength(181)
    for (const s of v.samples) {
      expect(s.heightKm).toBeGreaterThan(380)
      expect(s.heightKm).toBeLessThan(440)
      expect(Math.abs(s.latDeg)).toBeLessThan(52)
      expect(s.sunlit).toBeGreaterThanOrEqual(0)
      expect(s.sunlit).toBeLessThanOrEqual(1)
    }
    // One orbit spends part of its time in Earth's shadow.
    expect(v.samples.some((s) => s.sunlit === 0)).toBe(true)
    expect(v.samples.some((s) => s.sunlit === 1)).toBe(true)
  })

  it('moves about 3.8° of ground per minute', () => {
    const t = Date.UTC(2026, 9, 24, 12)
    const a = subpoint(iss.propagate(t).rTeme, skyAt(t).gmstRad)
    const b = subpoint(iss.propagate(t + 60_000).rTeme, skyAt(t + 60_000).gmstRad)
    expect(centralAngleDeg(a, b)).toBeGreaterThan(3.3)
    expect(centralAngleDeg(a, b)).toBeLessThan(4.2)
  })
})
