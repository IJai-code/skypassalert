import { bedtimeLabel, DEFAULT_FAMILY, isAfterBedtime, loadFamily, saveFamily } from './settings.ts'

const LA = 'America/Los_Angeles'
// 2026-10-24 local times in Fremont (PDT, UTC−7).
const at = (hhmm: string, day = '24') => Date.parse(`2026-10-${day}T${hhmm}:00-07:00`)

describe('bedtime', () => {
  it('compares evening clocks: 9:30 pm bedtime', () => {
    expect(isAfterBedtime(at('19:32'), LA, '21:30')).toBe(false)
    expect(isAfterBedtime(at('21:30'), LA, '21:30')).toBe(true)
    expect(isAfterBedtime(at('22:10'), LA, '21:30')).toBe(true)
    // Past midnight is later still.
    expect(isAfterBedtime(at('01:10', '25'), LA, '21:30')).toBe(true)
  })
  it('handles a bedtime after midnight', () => {
    expect(isAfterBedtime(at('23:45'), LA, '00:30')).toBe(false)
    expect(isAfterBedtime(at('00:45', '25'), LA, '00:30')).toBe(true)
  })
  it('never counts before-dawn passes or "any time"', () => {
    expect(isAfterBedtime(at('05:40', '25'), LA, '21:30')).toBe(false)
    expect(isAfterBedtime(at('23:00'), LA, null)).toBe(false)
  })
  it('labels the clock for the running head', () => {
    expect(bedtimeLabel('21:30')).toBe('9:30 pm')
    expect(bedtimeLabel('00:05')).toBe('12:05 am')
    expect(bedtimeLabel(null)).toBe('any time')
  })
  it('round-trips through storage and ignores bad data', () => {
    localStorage.clear()
    expect(loadFamily()).toEqual(DEFAULT_FAMILY)
    saveFamily({ bedtime: '20:15', simpleWords: true })
    expect(loadFamily()).toEqual({ bedtime: '20:15', simpleWords: true })
    saveFamily({ bedtime: null, simpleWords: false })
    expect(loadFamily().bedtime).toBeNull()
    localStorage.setItem('spa:family', '{"bedtime":"9pm"}')
    expect(loadFamily()).toEqual(DEFAULT_FAMILY)
    localStorage.clear()
  })
})
