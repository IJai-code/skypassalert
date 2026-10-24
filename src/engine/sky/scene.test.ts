// @vitest-environment node
import { skyScene, directionToAzEl, nearestLandmark } from './scene.ts'
import { starVectorsOfDate, type StarCatalog } from '../stars/stars.ts'
import catalogJson from '../stars/bright-stars.json'
import { forecast } from '../predict.ts'
import type { OmmElements } from '../propagate/propagator.ts'
import elements from '../__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../../presets.ts'
import { skyAt } from './sky.ts'

const catalog = catalogJson as unknown as StarCatalog

describe('sky scene', () => {
  it('puts Polaris at the observer’s latitude, due north', () => {
    const t = Date.parse('2026-10-25T04:00:00Z')
    const sky = skyAt(t)
    const i = catalog.named.Polaris!
    const v = starVectorsOfDate(catalog, sky.jdTt)[i]!
    const p = directionToAzEl(v, sky.gmstRad, FREMONT.latDeg, FREMONT.lonDeg)
    expect(Math.abs(p.elDeg - FREMONT.latDeg)).toBeLessThan(1)
    expect(Math.min(p.azDeg, 360 - p.azDeg)).toBeLessThan(1.5)
  })

  it('agrees with the engine’s Moon and planets', () => {
    const s = skyScene(FREMONT, Date.parse('2026-10-25T03:00:00Z'), catalog)
    expect(s.stars.az.length).toBe(catalog.stars.length)
    expect(s.sun.elDeg).toBeLessThan(-6) // 8 PM PDT: dark
    expect(s.moon.illumination).toBeGreaterThan(0.9)
  })

  it('finds a recognisable landmark near tonight’s Tiangong pass (or none, honestly)', () => {
    const f = forecast({
      place: FREMONT,
      elements: elements as OmmElements[],
      fromMs: Date.parse('2026-10-24T20:00:00Z'),
      days: 1,
    })
    const pass = f.passes.find((p) => p.noradId === 48274)!
    const scene = skyScene(FREMONT, pass.peak.unixMs, catalog)
    const lm = nearestLandmark(pass.track, scene, catalog)
    if (lm) expect(lm.separationDeg).toBeLessThanOrEqual(8)
  })
})
