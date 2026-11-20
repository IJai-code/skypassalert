// Tonight's answer: which pass the screen is about and how to introduce it.
// The 3-second rule lives here.
// Docs: docs/DESIGN.md#answer
import type { ForecastPass } from '../engine/index.ts'
import { stationName } from '../copy/en.ts'
import { countdown, dayLabel, formatDate } from '../lib/format.ts'
import type { HomeState } from '../lib/state.ts'

/** Which pass the screen is about, and how to introduce it. */
export type AnswerModel = {
  kind: HomeState['kind'] | 'focus'
  pass: ForecastPass | null
  eyebrow: string
  /** Shown instead of a time when there's nothing tonight. */
  headline?: string
  sub?: string
  /** A clearly better pass after bedtime, mentioned in a footnote (D-032). */
  late?: ForecastPass | null
}

export function answerModel(
  state: HomeState<ForecastPass>,
  focus: ForecastPass | null,
  placeName: string,
  nowMs: number,
  tz: string,
): AnswerModel {
  if (focus) {
    const day = dayLabel(focus.start.unixMs, nowMs, tz)
    return {
      kind: 'focus',
      pass: focus,
      eyebrow:
        day === 'Today'
          ? `Tonight in ${placeName}`
          : `${day}, ${formatDate(focus.start.unixMs, tz).split(', ')[1]}`,
    }
  }
  switch (state.kind) {
    case 'look-now':
      return { kind: state.kind, pass: state.pass, eyebrow: 'It’s up right now' }
    case 'get-ready':
      return {
        kind: state.kind,
        pass: state.pass,
        eyebrow: `Get ready · ${countdown(state.pass.start.unixMs - nowMs)}`,
      }
    case 'tonight':
      return {
        kind: state.kind,
        pass: state.pass,
        eyebrow: `Tonight in ${placeName}`,
        late: state.late,
      }
    case 'just-ended':
      return {
        kind: state.kind,
        pass: state.next,
        eyebrow: state.next
          ? `Next: ${dayLabel(state.next.start.unixMs, nowMs, tz)}`
          : 'Nothing more this week',
        headline: `${stationName(state.pass.noradId).short} just went by.`,
        sub: 'Did you catch it? Here’s the next one.',
      }
    case 'not-tonight':
      return {
        kind: state.kind,
        pass: state.next,
        eyebrow: state.next
          ? `Next good look: ${dayLabel(state.next.start.unixMs, nowMs, tz)}`
          : 'Nothing this week',
        headline: 'No station tonight.',
        sub: 'The stations come in runs of a week or two. Here’s the next one.',
        late: state.late,
      }
  }
}

export const capitalise = (s: string) => s[0]?.toUpperCase() + s.slice(1)
export const stationLong = (noradId: number) => capitalise(stationName(noradId).long)
