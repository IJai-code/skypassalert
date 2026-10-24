// @vitest-environment node
import { forecast } from './predict.ts'
import type { OmmElements } from './propagate/propagator.ts'
import { isDeepSpace, epochToUnixMs } from './propagate/propagator.ts'
import { localParts } from './time/zone.ts'
import elements from './__fixtures__/stations-2026-10-24.json'

const fremont = {
  id: 'fremont-ca-us',
  name: 'Fremont',
  latDeg: 37.5483,
  lonDeg: -121.9886,
  elevationM: 17,
  timeZone: 'America/Los_Angeles',
}

describe('forecast()', () => {
  const f = forecast({
    place: fremont,
    elements: elements as OmmElements[],
    fromMs: Date.parse('2026-10-24T19:00:00Z'),
    days: 7,
  })

  it('returns passes for both stations in time order', () => {
    expect(new Set(f.passes.map((p) => p.noradId))).toEqual(new Set([25544, 48274]))
    for (let i = 1; i < f.passes.length; i++) {
      expect(f.passes[i]!.start.unixMs).toBeGreaterThanOrEqual(f.passes[i - 1]!.start.unixMs)
    }
  })

  it('computes one evening per day with a plausible Fremont sunset', () => {
    expect(f.nights).toHaveLength(7)
    const first = f.nights[0]!.evening
    expect(first.dateKey).toBe('2026-10-24')
    const p = localParts(first.sunsetMs!, fremont.timeZone)
    // Late-October sunsets in the Bay Area are a little after 6 PM, toward the WSW.
    expect(p.hour).toBe(18)
    expect(first.sunsetAzDeg!).toBeGreaterThan(245)
    expect(first.sunsetAzDeg!).toBeLessThan(260)
    expect(first.civilDuskMs! - first.sunsetMs!).toBeGreaterThan(20 * 60_000)
  })

  it('reports the Moon and some bright planets', () => {
    const n = f.nights[0]!
    expect(n.moon.illumination).toBeGreaterThanOrEqual(0)
    expect(n.moon.illumination).toBeLessThanOrEqual(1)
    expect(n.planets.length).toBeGreaterThan(0)
  })

  it('reports element ages', () => {
    expect(f.elements.map((e) => e.noradId).sort()).toEqual([25544, 48274])
  })
})

describe('propagator helpers', () => {
  it('flags deep-space orbits (period ≥ 225 min)', () => {
    const base = (elements as OmmElements[])[0]!
    expect(isDeepSpace(base)).toBe(false)
    expect(isDeepSpace({ ...base, MEAN_MOTION: 2.0 })).toBe(true)
  })
  it('parses OMM epochs as UTC', () => {
    expect(new Date(epochToUnixMs('2026-10-24T05:01:11.149248')).toISOString()).toBe(
      '2026-10-24T05:01:11.149Z',
    )
  })
})
