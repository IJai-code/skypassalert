import { buildIcs, escapeText, foldLine } from './ics.ts'

describe('calendar export', () => {
  const ics = buildIcs(
    {
      uid: '48274-1792895576000@skypassalert.com',
      startMs: Date.parse('2026-10-25T02:32:56Z'),
      endMs: Date.parse('2026-10-25T02:36:56Z'),
      title: 'Tiangong over Fremont, CA: look WSW',
      description: 'Rises low in the west-southwest, climbs almost overhead; fades out.',
      location: 'Fremont, CA',
      url: 'https://skypassalert.com/?s=ics',
      alarmMinutesBefore: 10,
    },
    Date.parse('2026-10-24T20:00:00Z'),
  )

  it('uses UTC timestamps and CRLF line endings', () => {
    expect(ics).toContain('DTSTART:20261025T023256Z\r\n')
    expect(ics).toContain('DTEND:20261025T023656Z\r\n')
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true)
  })
  it('includes a reminder 10 minutes before', () => {
    expect(ics).toContain('TRIGGER:-PT10M')
  })
  it('escapes commas and semicolons in text', () => {
    expect(escapeText('a, b; c\nd')).toBe('a\\, b\\; c\\nd')
    expect(ics).toContain('SUMMARY:Tiangong over Fremont\\, CA: look WSW')
  })
  it('folds long lines at 75 octets, counting multi-byte characters', () => {
    const folded = foldLine('DESCRIPTION:' + '天'.repeat(40))
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
