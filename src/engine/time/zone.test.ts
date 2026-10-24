// @vitest-environment node
import { addDays, localDateKey, localParts, offsetMinutes, zonedTimeToUnixMs } from './zone.ts'

const LA = 'America/Los_Angeles'

describe('IANA time zones', () => {
  it('Fremont is UTC−7 in October and UTC−8 after the 2026-11-01 change', () => {
    expect(offsetMinutes(Date.parse('2026-10-24T20:00:00Z'), LA)).toBe(-420)
    expect(offsetMinutes(Date.parse('2026-11-02T20:00:00Z'), LA)).toBe(-480)
  })
  it('resolves the repeated hour on 2026-11-01 to the first (PDT) 01:30', () => {
    expect(new Date(zonedTimeToUnixMs(LA, 2026, 11, 1, 1, 30)).toISOString()).toBe(
      '2026-11-01T08:30:00.000Z',
    )
  })
  it('pushes the skipped 02:30 on 2027-03-14 forward to 03:30 PDT', () => {
    expect(new Date(zonedTimeToUnixMs(LA, 2027, 3, 14, 2, 30)).toISOString()).toBe(
      '2027-03-14T10:30:00.000Z',
    )
  })
  it('handles quarter-hour and half-hour zones', () => {
    expect(offsetMinutes(Date.parse('2026-10-24T00:00:00Z'), 'Asia/Kathmandu')).toBe(345)
    // Lord Howe Island: +10:30 standard, +11:00 in (southern) summer: a 30-minute DST.
    expect(offsetMinutes(Date.parse('2026-07-01T00:00:00Z'), 'Australia/Lord_Howe')).toBe(630)
    expect(offsetMinutes(Date.parse('2027-01-15T00:00:00Z'), 'Australia/Lord_Howe')).toBe(660)
  })
  it('knows southern-hemisphere DST runs over New Year', () => {
    expect(offsetMinutes(Date.parse('2027-01-15T00:00:00Z'), 'Australia/Sydney')).toBe(660)
    expect(offsetMinutes(Date.parse('2026-07-15T00:00:00Z'), 'Australia/Sydney')).toBe(600)
  })
  it('gives the local calendar date, not the UTC one', () => {
    // 02:32 UTC on the 25th is 19:32 on the 24th in Fremont.
    expect(localDateKey(Date.parse('2026-10-25T02:32:56Z'), LA)).toBe('2026-10-24')
    expect(localParts(Date.parse('2026-10-25T02:32:56Z'), LA)).toMatchObject({
      hour: 19,
      minute: 32,
      weekday: 6,
    })
  })
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})
