// What should the top of the screen say right now? A pure function of the
// forecast and the clock, so every state is unit-testable.
// Flighty-style: the screen moves through states as the pass approaches.
import type { Forecast, VisiblePass } from '../engine/index.ts'
import { passPeriod, passScore } from '../engine/sky/schedule.ts'
import { addDays, localDateKey, parseDateKey, zonedTimeToUnixMs } from '../engine/time/zone.ts'

export const GET_READY_MS = 15 * 60_000
const JUST_ENDED_MS = 20 * 60_000
/** Passes scoring below this aren't worth sending a family outside for. */
export const WORTH_IT = 0.25

export type HomeState<P extends VisiblePass = VisiblePass> =
  | { kind: 'look-now'; pass: P }
  | { kind: 'get-ready'; pass: P }
  | { kind: 'tonight'; pass: P }
  | { kind: 'just-ended'; pass: P; next: P | null }
  | { kind: 'not-tonight'; next: P | null }

const isEveningish = (p: VisiblePass, tz: string) => passPeriod(p, tz) !== 'before-dawn'

/** End of "tonight": 04:00 local after the current evening. */
function tonightEnds(nowMs: number, tz: string): number {
  const today = localDateKey(nowMs, tz)
  const fourAmToday = zonedTimeToUnixMs(tz, ...parseDateKey(today), 4)
  return nowMs < fourAmToday
    ? fourAmToday
    : zonedTimeToUnixMs(tz, ...parseDateKey(addDays(today, 1)), 4)
}

export function homeState<P extends VisiblePass>(
  forecast: Pick<Forecast, 'place'> & { passes: readonly P[] },
  nowMs: number,
): HomeState<P> {
  const tz = forecast.place.timeZone
  const passes = forecast.passes
  const nowPass = passes.find((p) => p.start.unixMs <= nowMs && nowMs <= p.end.unixMs)
  if (nowPass) return { kind: 'look-now', pass: nowPass }

  const end = tonightEnds(nowMs, tz)
  const tonight = passes.filter(
    (p) =>
      p.start.unixMs > nowMs &&
      p.start.unixMs < end &&
      isEveningish(p, tz) &&
      passScore(p) >= WORTH_IT,
  )
  const soon = tonight.find((p) => p.start.unixMs - nowMs <= GET_READY_MS)
  if (soon) return { kind: 'get-ready', pass: soon }

  const next = nextGoodPass(passes, Math.max(nowMs, end - 1), tz)
  const ended = [...passes]
    .reverse()
    .find((p) => p.end.unixMs < nowMs && nowMs - p.end.unixMs <= JUST_ENDED_MS)
  if (ended) return { kind: 'just-ended', pass: ended, next: tonight[0] ?? next }

  const best = tonight.reduce<P | null>((a, p) => (!a || passScore(p) > passScore(a) ? p : a), null)
  if (best) return { kind: 'tonight', pass: best }
  return { kind: 'not-tonight', next }
}

/** The soonest evening pass worth going out for, after `afterMs`. */
export function nextGoodPass<P extends VisiblePass>(
  passes: readonly P[],
  afterMs: number,
  tz: string,
): P | null {
  return (
    passes.find(
      (p) => p.start.unixMs > afterMs && isEveningish(p, tz) && passScore(p) >= WORTH_IT,
    ) ?? null
  )
}
