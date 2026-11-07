// Passes → calendar events, and saving the file. Shared by "Remind me" (one
// pass) and "next two weeks" (every good evening pass before bedtime).
// Docs: docs/DECISIONS.md (D-032)
import type { VisiblePass } from '../engine/index.ts'
import { compass8 } from '../engine/describe/describe.ts'
import { passPeriod, passScore } from '../engine/sky/schedule.ts'
import { pathSentence, startCue, stationName } from '../copy/en.ts'
import { buildIcsCalendar, type IcsEvent } from './ics.ts'
import { isAfterBedtime } from './settings.ts'
import { WORTH_IT } from './state.ts'

const URL_ICS = 'https://skypassalert.com/?s=ics'
const DAY = 86_400_000
/** Beyond this, predictions drift by minutes as the orbit changes (docs/accuracy). */
export const FIRM_DAYS = 3

export function passEvent(p: VisiblePass, placeName: string, nowMs: number): IcsEvent {
  const far = p.start.unixMs - nowMs > FIRM_DAYS * DAY
  return {
    uid: `${p.noradId}-${Math.round(p.start.unixMs / 1000)}@skypassalert.com`,
    startMs: p.start.unixMs,
    endMs: p.end.unixMs,
    title: `${stationName(p.noradId).short} over ${placeName}: look ${compass8(p.start.azDeg)}`,
    description: [
      pathSentence(p),
      startCue(p, null, false),
      far
        ? 'This is more than 3 days away, so the time can shift by a few minutes. Check skypassalert.com the day before.'
        : 'Times from SkyPassAlert; orbits shift a little, so check the site for updates.',
      URL_ICS,
    ].join(' '),
    location: placeName,
    url: URL_ICS,
    alarmMinutesBefore: 10,
  }
}

/** Evening passes worth going out for, before bedtime, in the next `days`. */
export function goodEvenings<P extends VisiblePass>(
  passes: readonly P[],
  nowMs: number,
  tz: string,
  bedtime: string | null,
  days = 14,
): P[] {
  return passes.filter(
    (p) =>
      p.start.unixMs > nowMs &&
      p.start.unixMs < nowMs + days * DAY &&
      passPeriod(p, tz) !== 'before-dawn' &&
      passScore(p) >= WORTH_IT &&
      !isAfterBedtime(p.start.unixMs, tz, bedtime),
  )
}

export function calendarFor(passes: readonly VisiblePass[], placeName: string, nowMs: number) {
  return buildIcsCalendar(
    passes.map((p) => passEvent(p, placeName, nowMs)),
    nowMs,
  )
}

export function saveIcs(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
