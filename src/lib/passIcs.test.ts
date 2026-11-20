// @vitest-environment node
import { calendarFor, goodEvenings } from './passIcs.ts'
import { forecast } from '../engine/predict.ts'
import type { OmmElements } from '../engine/index.ts'
import elements from '../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../presets.ts'

const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 15,
})
const now = Date.parse('2026-10-24T20:00:00Z')
const tz = FREMONT.timeZone

describe('two weeks in one calendar file', () => {
  const good = goodEvenings(f.passes, now, tz, '21:30')

  it('takes only good evening passes before bedtime, within 14 days', () => {
    expect(good.length).toBeGreaterThan(5)
    for (const p of good) {
      expect(p.start.unixMs).toBeGreaterThan(now)
      expect(p.start.unixMs).toBeLessThan(now + 14 * 86_400_000)
    }
    expect(goodEvenings(f.passes, now, tz, '19:00').length).toBeLessThan(good.length)
  })

  it('writes one VEVENT with its own alarm per pass, across the DST change', () => {
    const ics = calendarFor(good, 'Fremont, CA', now)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(good.length)
    expect(ics.match(/TRIGGER:-PT10M/g)).toHaveLength(good.length)
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1)
    // Clocks change on 1 Nov; UTC timestamps keep both sides right.
    expect(good.some((p) => p.start.unixMs > Date.parse('2026-11-01T09:00:00Z'))).toBe(true)
    expect(ics).toMatch(/DTSTART:202611\d\dT\d{6}Z/)
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })

  it('warns that far-off times can shift', () => {
    const ics = calendarFor(good, 'Fremont, CA', now).replace(/\r\n /g, '')
    expect(ics).toContain('more than 3 days away')
  })
})
