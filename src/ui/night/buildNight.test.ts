// @vitest-environment node
import { bestOtherThing, buildNight, pickNight, stopSpan, type Night } from './buildNight.ts'
import { forecast } from '../../engine/predict.ts'
import type { OmmElements } from '../../engine/index.ts'
import elements from '../../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../../presets.ts'

const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 8,
})
const local = (ms: number) =>
  new Date(ms).toLocaleString('en-US', {
    timeZone: FREMONT.timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })

describe('the night as stops (Fremont, 2026-10-24)', () => {
  const n = buildNight(f, Date.parse('2026-10-24T20:00:00Z'))! // 1 PM PDT

  it('runs from an hour before sunset to sunrise, in time order', () => {
    expect(n.stops[0]!.kind).toBe('sunset')
    expect(n.stops.at(-1)!.kind).toBe('sunrise')
    expect(n.startMs).toBe(n.night.evening.sunsetMs! - 3_600_000)
    for (let i = 1; i < n.stops.length; i++)
      expect(n.stops[i]!.atMs).toBeGreaterThanOrEqual(n.stops[i - 1]!.atMs)
  })

  it('includes Tiangong at 7:32 PM and the pre-dawn ISS marked for early risers', () => {
    const passes = n.stops.filter((s) => s.kind === 'pass')
    const tiangong = passes.find((s) => s.pass.noradId === 48274)!
    expect(local(tiangong.atMs)).toBe('7:32 PM')
    expect(tiangong.dawn).toBe(false)
    const iss = passes.filter((s) => s.pass.noradId === 25544)
    expect(iss.length).toBeGreaterThan(0)
    for (const s of iss) expect(s.dawn).toBe(true)
  })

  it('gives a pass stop its whole visible span to scrub', () => {
    const s = n.stops.find((x) => x.kind === 'pass')!
    const [a, b] = stopSpan(s)
    expect(b - a).toBeGreaterThan(60_000)
  })

  it('starts at now once the night has begun', () => {
    const now = Date.parse('2026-10-25T04:00:00Z') // 9 PM PDT
    const late = buildNight(f, now)!
    expect(late.startMs).toBe(now)
    expect(late.stops.some((s) => s.kind === 'sunset')).toBe(false)
  })

  it('shows the night of a pass the user picked', () => {
    const later = f.passes.find((p) => p.start.unixMs > Date.parse('2026-10-28T00:00:00Z'))!
    const picked = pickNight(f, Date.parse('2026-10-24T20:00:00Z'), later.start.unixMs)!
    expect(picked.evening.sunriseMs!).toBeGreaterThan(later.start.unixMs)
    expect(picked.evening.sunsetMs!).toBeLessThan(later.start.unixMs + 14 * 3_600_000)
  })

  it('handles the night the clocks change (2026-11-01)', () => {
    const dst = buildNight(f, Date.parse('2026-10-31T20:00:00Z'))!
    expect(dst.night.evening.dateKey).toBe('2026-10-31')
    expect(dst.endMs - dst.startMs).toBeGreaterThan(12 * 3_600_000)
    expect(dst.endMs - dst.startMs).toBeLessThan(16 * 3_600_000)
  })
})

describe('family and extras', () => {
  const t = Date.parse('2026-10-24T20:00:00Z')

  it('marks evening passes after bedtime, never pre-dawn ones', () => {
    const n = buildNight(f, t, undefined, '19:00')!
    const passes = n.stops.filter((s) => s.kind === 'pass')
    const tiangong = passes.find((s) => s.kind === 'pass' && !s.dawn)
    const dawn = passes.find((s) => s.kind === 'pass' && s.dawn)
    expect(tiangong?.kind === 'pass' && tiangong.late).toBe(true)
    expect(dawn?.kind === 'pass' && dawn.late).toBe(false)
  })

  it('adds a meteor line on a shower night (Southern Taurids, 2 Nov)', () => {
    const f15 = forecast({
      place: FREMONT,
      elements: elements as OmmElements[],
      fromMs: f.fromMs,
      days: 15,
    })
    const n = buildNight(f15, Date.parse('2026-11-02T20:00:00Z'))!
    const m = n.stops.find((s) => s.kind === 'meteor')
    expect(m?.kind === 'meteor' && m.shower.id).toBe('STA')
  })

  it('picks the best other thing: Moon, then the brightest planet, then a shower', () => {
    const n = buildNight(f, t)!
    expect(bestOtherThing(n)?.kind).toBe('moon')
    const noMoon: Night = { ...n, stops: n.stops.filter((s) => s.kind !== 'moon') }
    expect(bestOtherThing(noMoon)?.kind).toBe('planet')
    const quiet: Night = {
      ...n,
      stops: n.stops.filter((s) => s.kind !== 'moon' && s.kind !== 'planet'),
    }
    expect(bestOtherThing(quiet)).toBeNull()
  })
})
