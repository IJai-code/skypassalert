// @vitest-environment node
import { readFileSync } from 'node:fs'
import { magneticField, declinationDeg } from './wmm.ts'

// NOAA's official WMM2025 test values (data/fixtures/WMM2025_TestValues.txt).
const rows = readFileSync(
  new URL('../../../data/fixtures/WMM2025_TestValues.txt', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => l.trim().split(/\s+/).map(Number))

describe('World Magnetic Model 2025', () => {
  it.each(rows.map((r) => [`${r[0]} h=${r[1]} km (${r[2]}, ${r[3]})`, r] as const))(
    'matches NOAA test value %s',
    (_, r) => {
      // Columns: year, altitude km, lat, lon, D, I, H, X, Y, Z, F, …
      const [year, h, lat, lon, D, I, , X, Y, Z] = r as number[]
      const f = magneticField(lat!, lon!, h!, year!)
      expect(Math.abs(f.declinationDeg - D!)).toBeLessThan(0.01)
      expect(Math.abs(f.inclinationDeg - I!)).toBeLessThan(0.01)
      expect(Math.abs(f.x - X!)).toBeLessThan(0.1)
      expect(Math.abs(f.y - Y!)).toBeLessThan(0.1)
      expect(Math.abs(f.z - Z!)).toBeLessThan(0.1)
    },
  )
  it('puts magnetic north ~13° east of true north in Fremont', () => {
    const d = declinationDeg(37.54827, -121.98857, Date.parse('2026-10-24T00:00:00Z'))
    expect(d).toBeGreaterThan(12)
    expect(d).toBeLessThan(14)
  })
})
