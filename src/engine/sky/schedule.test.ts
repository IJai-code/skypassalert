// @vitest-environment node
import { bestPass, passPeriod, passScore } from './schedule.ts'
import type { VisiblePass } from '../passes/finder.ts'

const LA = 'America/Los_Angeles'
function pass(startIso: string, minutes: number, peakEl: number, mag: number): VisiblePass {
  const s = Date.parse(startIso)
  const pt = (t: number, el: number) => ({ unixMs: t, azDeg: 270, elDeg: el, rangeKm: 800 })
  return {
    noradId: 1,
    name: 'TEST',
    start: { ...pt(s, 10), reason: 'rise' },
    peak: { ...pt(s + (minutes / 2) * 60_000, peakEl), magnitude: mag },
    end: { ...pt(s + minutes * 60_000, 10), reason: 'sets' },
    brightestMagnitude: mag,
    sunAltitudeDeg: -10,
    track: [],
  }
}

describe('ranking and periods', () => {
  const early = pass('2026-10-25T02:32:00Z', 4, 80, -2.2) // 19:32 PDT
  const late = pass('2026-10-25T05:30:00Z', 4, 85, -3.5) // 22:30 PDT
  const dawn = pass('2026-10-25T13:58:00Z', 4, 80, -3.7) // 06:58 PDT

  it('labels periods by local clock time', () => {
    expect(passPeriod(early, LA)).toBe('evening')
    expect(passPeriod(late, LA)).toBe('late-night')
    expect(passPeriod(dawn, LA)).toBe('before-dawn')
  })
  it('scores high, bright, long passes above low, faint, short ones', () => {
    expect(passScore(early)).toBeGreaterThan(passScore(pass('2026-10-25T03:00:00Z', 1, 15, 1.5)))
  })
  it('never offers a pre-dawn pass as "tonight" by default', () => {
    expect(bestPass([dawn], { timeZone: LA })).toBeNull()
  })
  it('respects the bedtime filter', () => {
    expect(bestPass([early, late], { timeZone: LA, periods: ['evening', 'late-night'] })).toBe(late)
    expect(
      bestPass([early, late], {
        timeZone: LA,
        periods: ['evening', 'late-night'],
        bedtime: '21:30',
      }),
    ).toBe(early)
  })
})
