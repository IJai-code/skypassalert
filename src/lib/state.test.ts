// @vitest-environment node
import { homeState } from './state.ts'
import { forecast } from '../engine/predict.ts'
import type { OmmElements } from '../engine/index.ts'
import elements from '../engine/__fixtures__/stations-2026-10-24.json'
import { FREMONT } from '../presets.ts'

// Real forecast for Fremont from the frozen 2026-10-24 elements.
const f = forecast({
  place: FREMONT,
  elements: elements as OmmElements[],
  fromMs: Date.parse('2026-10-24T15:00:00Z'),
  days: 8,
})
const at = (iso: string) => homeState(f, Date.parse(iso))

describe('home screen states (Fremont, week of 2026-10-24)', () => {
  it('afternoon: tonight’s best is Tiangong at 7:32 PM', () => {
    const s = at('2026-10-24T20:00:00Z') // 1 PM PDT
    expect(s.kind).toBe('tonight')
    if (s.kind === 'tonight') {
      expect(s.pass.noradId).toBe(48274)
      expect(new Date(s.pass.start.unixMs).toISOString()).toMatch(/^2026-10-25T02:32:5/)
    }
  })
  it('10 minutes before: get ready', () => {
    expect(at('2026-10-25T02:23:00Z').kind).toBe('get-ready')
  })
  it('during the pass: look now', () => {
    expect(at('2026-10-25T02:34:30Z').kind).toBe('look-now')
  })
  it('just after: offers the next evening pass, not a pre-dawn ISS one', () => {
    const s = at('2026-10-25T02:45:00Z')
    expect(s.kind).toBe('just-ended')
    if (s.kind === 'just-ended') {
      expect(s.next?.noradId).toBe(48274)
      expect(new Date(s.next!.start.unixMs).toISOString()).toMatch(/^2026-10-26T03:10/) // Sun 8:10 PM
    }
  })
  it('late at night: nothing more tonight, next good look tomorrow evening', () => {
    const s = at('2026-10-25T06:30:00Z') // 11:30 PM PDT
    expect(s.kind).toBe('not-tonight')
    if (s.kind === 'not-tonight') expect(s.next?.noradId).toBe(48274)
  })
  it('never calls a pre-dawn ISS pass "tonight"', () => {
    for (let h = 0; h < 24 * 7; h += 1) {
      const s = homeState(f, Date.parse('2026-10-24T20:00:00Z') + h * 3_600_000)
      if (s.kind === 'tonight' || s.kind === 'get-ready') {
        const hour = new Date(s.pass.start.unixMs).toLocaleString('en-US', {
          timeZone: FREMONT.timeZone,
          hour: 'numeric',
          hour12: false,
        })
        expect(Number(hour)).toBeGreaterThanOrEqual(12)
      }
    }
  })
})
