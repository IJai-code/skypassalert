// The answer, in two parts: the headline that sits on the sky picture (time,
// station, countdown) and the details under it (path in words, how to find
// it, what's near it, actions). The 3-second rule lives here.
// Docs: docs/DESIGN.md#answer
import type { ForecastPass, NightSky } from '../engine/index.ts'
import { passPeriod } from '../engine/sky/schedule.ts'
import type { Landmark } from '../engine/sky/scene.ts'
import {
  brightnessSentence,
  direction,
  endNote,
  fistsLabel,
  minutesLabel,
  pathSentence,
  startCue,
  stationName,
} from '../copy/en.ts'
import { countdown, dayLabel, formatDate, timeParts } from '../lib/format.ts'
import type { HomeState } from '../lib/state.ts'
import { CalendarButton } from './CalendarButton.tsx'

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

/** Overlaid on the sky picture. */
export function Headline({
  model,
  timeZone,
  nowMs,
}: {
  model: AnswerModel
  timeZone: string
  nowMs: number
}) {
  const p = model.pass
  const until = p ? p.start.unixMs - nowMs : 0
  return (
    <div>
      {model.headline && (
        <p className="mb-3 text-lg font-semibold text-balance">{model.headline}</p>
      )}
      <div className="flex items-baseline justify-between gap-4">
        <h1 id="answer" className="text-base font-medium text-white/80">
          {model.eyebrow}
        </h1>
        {p && until > 0 && model.kind !== 'get-ready' && (
          <span className="tnum text-sm text-white/75">{countdown(until)}</span>
        )}
      </div>
      {p && model.kind === 'look-now' ? (
        <p className="mt-1 text-[clamp(2.4rem,11vw,4rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          Look {direction(liveAz(p, nowMs).azDeg)},{' '}
          <span className="whitespace-nowrap">{fistsLabel(liveAz(p, nowMs).elDeg)} up.</span>
        </p>
      ) : (
        p && <BigTime ms={p.start.unixMs} timeZone={timeZone} />
      )}
      {p && (
        <p className="mt-2 text-lg">
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-2.5 rounded-full bg-station align-[0.1em]"
          />
          <span className="font-semibold">{capitalise(stationName(p.noradId).long)}</span>
        </p>
      )}
    </div>
  )
}

/** Under the picture: the path in words, how to find it, actions. */
export function Details(props: {
  model: AnswerModel
  nights: readonly NightSky[]
  landmark: Landmark | null
  placeName: string
  timeZone: string
  onFindIt: () => void
  onClearFocus: () => void
  nightMode: boolean
  onNightMode: (on: boolean) => void
}) {
  const { model, nights, landmark, placeName, timeZone } = props
  const p = model.pass
  if (!p) return <p className="text-lg text-ink-2">{model.sub ?? 'Check back soon.'}</p>
  const isEvening = passPeriod(p, timeZone) !== 'before-dawn'
  const night = nights.find(
    (n) =>
      n.evening.sunsetMs !== null && Math.abs(p.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
  )
  const note = endNote(p)
  const urgent = model.kind === 'get-ready' || model.kind === 'look-now'

  return (
    <section aria-label="How to see it">
      {model.sub && <p className="mb-4 text-ink-2">{model.sub}</p>}
      <p className="max-w-[38ch] text-xl leading-snug text-pretty">{pathSentence(p)}</p>
      <ul className="mt-5 space-y-2.5 text-[1.0625rem] text-ink-2">
        <Cue>{startCue(p, night?.evening.sunsetAzDeg ?? null, isEvening)}</Cue>
        {landmark && <Cue>{landmarkSentence(landmark)}</Cue>}
        <Cue>
          {brightnessSentence(p.brightestMagnitude)} Visible for about{' '}
          {minutesLabel(p.end.unixMs - p.start.unixMs)}.
        </Cue>
        <Cue>
          It looks like a steady star sliding across the sky. No blinking lights: that’s how you
          tell it from a plane.
        </Cue>
        {note && <Cue>{note}</Cue>}
        {urgent && (
          <Cue>Head outside now and give your eyes a few minutes to adjust to the dark.</Cue>
        )}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={props.onFindIt}
          className="rounded-md bg-ink px-5 py-3 text-[0.9375rem] font-semibold text-night transition-opacity hover:opacity-90"
        >
          Find it in the sky
        </button>
        <CalendarButton pass={p} placeName={placeName} timeZone={timeZone} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {model.kind === 'focus' && (
          <button
            type="button"
            onClick={props.onClearFocus}
            className="text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          >
            Back to tonight
          </button>
        )}
        <button
          type="button"
          onClick={() => props.onNightMode(!props.nightMode)}
          className="text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
        >
          {props.nightMode ? 'Normal colors' : 'Red night light'}
        </button>
      </div>
    </section>
  )
}

function landmarkSentence(l: Landmark): string {
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

function BigTime({ ms, timeZone }: { ms: number; timeZone: string }) {
  const { clock, period } = timeParts(ms, timeZone)
  return (
    <p className="tnum mt-1 text-[clamp(4.25rem,21vw,7rem)] leading-[0.92] font-semibold tracking-[-0.04em]">
      {clock}
      <span className="ml-2 text-[0.34em] font-medium tracking-normal text-white/75">{period}</span>
    </p>
  )
}

function liveAz(p: ForecastPass, nowMs: number) {
  return p.track.reduce((a, q) => (Math.abs(q.unixMs - nowMs) < Math.abs(a.unixMs - nowMs) ? q : a))
}

const capitalise = (s: string) => s[0]?.toUpperCase() + s.slice(1)

function Cue({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[0.875rem_1fr] gap-2">
      <span aria-hidden="true" className="mt-[0.7em] h-px w-2.5 bg-ink-3" />
      <span className="text-pretty">{children}</span>
    </li>
  )
}
