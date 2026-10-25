// Tonight's answer: which pass the screen is about (answerModel) and how to
// see it, in words (HowToSee). The 3-second rule lives here.
// Docs: docs/DESIGN.md#answer
import type { ForecastPass, NightSky } from '../engine/index.ts'
import { passPeriod } from '../engine/sky/schedule.ts'
import type { Landmark } from '../engine/sky/scene.ts'
import {
  brightnessSentence,
  endNote,
  minutesLabel,
  pathSentence,
  startCue,
  stationName,
} from '../copy/en.ts'
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
      return { kind: state.kind, pass: state.pass, eyebrow: `Tonight in ${placeName}` }
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
        headline: 'No space station passes tonight.',
        sub: 'The stations come in runs of a week or two. Here’s the next one.',
      }
  }
}

/** The path in words and the steps to find it, as a numbered guide. */
export function HowToSee({
  pass,
  nights,
  landmark,
  timeZone,
}: {
  pass: ForecastPass
  nights: readonly NightSky[]
  landmark: Landmark | null
  timeZone: string
}) {
  const isEvening = passPeriod(pass, timeZone) !== 'before-dawn'
  const night = nights.find(
    (n) =>
      n.evening.sunsetMs !== null &&
      Math.abs(pass.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
  )
  const note = endNote(pass)
  const steps = [
    startCue(pass, night?.evening.sunsetAzDeg ?? null, isEvening),
    landmark ? landmarkSentence(landmark) : null,
    `${brightnessSentence(pass.brightestMagnitude)} Visible for about ${minutesLabel(pass.end.unixMs - pass.start.unixMs)}.`,
    'It looks like a steady star sliding across the sky. No blinking lights: that’s how you tell it from a plane.',
    note,
  ].filter((x): x is string => !!x)
  return (
    <section aria-label="How to see it">
      <p className="text-[1.1875rem] leading-snug text-pretty">{pathSentence(pass)}</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-3 text-[0.9688rem] text-ink-2">
            <span className="display grid size-7 place-items-center rounded-full bg-surface-2 text-[0.8125rem] text-action">
              {i + 1}
            </span>
            <span className="pt-0.5 text-pretty">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function landmarkSentence(l: Landmark): string {
  const close = l.separationDeg < 2.5
  const where = close
    ? 'right past'
    : `about ${l.separationDeg < 6 ? 'half a fist' : 'one fist'} from`
  const what =
    l.kind === 'star'
      ? `${l.name}, one of the brightest stars`
      : l.kind === 'planet'
        ? `the planet ${l.name}`
        : 'the Moon'
  return `It passes ${where} ${what}. A good landmark to watch for.`
}

export const capitalise = (s: string) => s[0]?.toUpperCase() + s.slice(1)
export const stationLong = (noradId: number) => capitalise(stationName(noradId).long)
