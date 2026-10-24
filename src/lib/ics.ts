// A one-pass calendar event (.ics, RFC 5545) with a 10-minute reminder,
// built on the device: no account, no server. Phase 3 adds 14-day files and
// Phase 5 subscribable feeds.

export type IcsEvent = {
  uid: string
  startMs: number
  endMs: number
  title: string
  description: string
  location: string
  url: string
  alarmMinutesBefore: number
}

const stamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** RFC 5545 §3.3.11: escape backslash, semicolon, comma and newlines. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 §3.1: fold lines longer than 75 octets (UTF-8) with CRLF + space. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder()
  const out: string[] = []
  let current = ''
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes.encode(current + ch).length > limit) {
      out.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildIcs(e: IcsEvent, nowMs: number = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkyPassAlert//Pass reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(nowMs)}`,
    `DTSTART:${stamp(e.startMs)}`,
    `DTEND:${stamp(e.endMs)}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    `LOCATION:${escapeText(e.location)}`,
    `URL:${e.url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(e.title)}`,
    `TRIGGER:-PT${e.alarmMinutesBefore}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
