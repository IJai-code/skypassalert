// @vitest-environment node
// Independent cross-check against Heavens-Above, a long-running, widely used
// predictor, for real Fremont passes the week of 2026-10-24, including the
// 2026-11-01 DST change. Learn: docs/learn/09-accuracy.md#cross-check
import { findPasses, type VisiblePass } from './finder.ts'
import { satelliteJsPropagator } from '../propagate/satellitejs-adapter.ts'
import type { OmmElements } from '../propagate/propagator.ts'
import { compass16 } from '../describe/describe.ts'
import { localDateKey, localParts } from '../time/zone.ts'
import elements from '../__fixtures__/stations-2026-10-24.json'
import ha from '../__fixtures__/heavens-above-fremont-2026-10-24.json'

const place = { id: 'fremont-ref', name: 'Fremont (Heavens-Above coords)', ...ha.observer }
const from = Date.parse('2026-10-24T07:00:00Z')
const to = Date.parse('2026-11-02T07:00:00Z')

const ours = new Map<number, VisiblePass[]>(
  (elements as OmmElements[]).map((e) => [
    e.NORAD_CAT_ID,
    findPasses(satelliteJsPropagator.init(e), place, from, to),
  ]),
)

const secondsOfDay = (ms: number) => {
  const p = localParts(ms, place.timeZone)
  return p.hour * 3600 + p.minute * 60 + p.second
}
const parseHms = (s: string) => s.split(':').reduce((a, b) => a * 60 + Number(b), 0)

type Row = (typeof ha.passes)[number]
const label = (r: Row) => `${r.noradId === 25544 ? 'ISS' : 'Tiangong'} ${r.date} ${r.start[0]}`

describe('agrees with Heavens-Above for Fremont', () => {
  it.each(ha.passes.map((r) => [label(r), r] as const))('%s', (_, row) => {
    const pass = ours
      .get(row.noradId)
      ?.find(
        (p) =>
          localDateKey(p.start.unixMs, place.timeZone) === row.date &&
          Math.abs(secondsOfDay(p.start.unixMs) - parseHms(String(row.start[0]))) <= 2,
      )
    expect(pass, 'pass found within 2 s of the published start').toBeDefined()
    if (!pass) return
    // Published values are rounded to the second and the degree.
    expect(
      Math.abs(secondsOfDay(pass.peak.unixMs) - parseHms(String(row.peak[0]))),
    ).toBeLessThanOrEqual(4)
    expect(Math.abs(pass.peak.elDeg - Number(row.peak[1]))).toBeLessThanOrEqual(1)
    expect(compass16(pass.start.azDeg)).toBe(row.start[2])
    if (row.end) {
      expect(
        Math.abs(secondsOfDay(pass.end.unixMs) - parseHms(String(row.end[0]))),
      ).toBeLessThanOrEqual(2)
    }
  })

  it('magnitudes track the published ones (fit residuals documented)', () => {
    const residuals: number[] = []
    for (const row of ha.passes) {
      const pass = ours
        .get(row.noradId)
        ?.find(
          (p) =>
            localDateKey(p.start.unixMs, place.timeZone) === row.date &&
            Math.abs(secondsOfDay(p.start.unixMs) - parseHms(String(row.start[0]))) <= 2,
        )
      if (pass) residuals.push(pass.brightestMagnitude - row.mag)
    }
    const within = residuals.filter((r) => Math.abs(r) <= 0.5).length
    expect(within / residuals.length).toBeGreaterThanOrEqual(0.85)
    expect(Math.max(...residuals.map(Math.abs))).toBeLessThan(1.5)
  })

  it('finds no ISS evening passes this week, but Tiangong almost every evening', () => {
    const evening = (p: VisiblePass) => localParts(p.start.unixMs, place.timeZone).hour >= 12
    expect(ours.get(25544)!.filter(evening)).toHaveLength(0)
    expect(
      new Set(
        ours
          .get(48274)!
          .filter(evening)
          .map((p) => localDateKey(p.start.unixMs, place.timeZone)),
      ).size,
    ).toBeGreaterThanOrEqual(8)
  })
})
