// The top of the screen: one big time, one sentence, and how to find it.
// The 3-second rule lives here. Docs: docs/DESIGN.md#answer
import type { ForecastPass, NightSky } from '../engine/index.ts'
import { passPeriod } from '../engine/sky/schedule.ts'
import {
  brightnessSentence,
  endNote,
  pathSentence,
  startCue,
  stationName,
  minutesLabel,
  direction,
  fistsLabel,
} from '../copy/en.ts'
import { countdown, dayLabel, formatDate, timeParts } from '../lib/format.ts'
import type { HomeState } from '../lib/state.ts'
import { CalendarButton } from './CalendarButton.tsx'

type Props = {
  state: HomeState<ForecastPass>
  /** A pass picked from the board overrides the automatic answer. */
  focus: ForecastPass | null
  onClearFocus: () => void
  nights: readonly NightSky[]
  placeName: string
  timeZone: string
  nowMs: number
  nightMode: boolean
  onNightMode: (on: boolean) => void
}

export function Answer(props: Props) {
  const { state, focus, timeZone, nowMs } = props
  if (focus)
    return (
      <PassAnswer {...props} pass={focus} eyebrow={eyebrowFor(focus, nowMs, timeZone)} focused />
    )

  switch (state.kind) {
    case 'look-now':
      return <LookNow {...props} pass={state.pass} />
    case 'get-ready':
      return (
        <PassAnswer
          {...props}
          pass={state.pass}
          eyebrow={`Get ready · ${countdown(state.pass.start.unixMs - nowMs)}`}
          urgent
        />
      )
    case 'tonight':
      return <PassAnswer {...props} pass={state.pass} eyebrow={`Tonight in ${props.placeName}`} />
    case 'just-ended':
      return (
        <NoPass
          {...props}
          headline={`${stationName(state.pass.noradId).short} just went by.`}
          sub="Did you catch it? If not, here’s the next one."
          next={state.next}
        />
      )
    case 'not-tonight':
      return (
        <NoPass
          {...props}
          headline="No space station passes tonight."
          sub="The stations aren’t always lit up when your sky is dark. They come in runs of a week or two."
          next={state.next}
        />
      )
  }
}

function eyebrowFor(p: ForecastPass, nowMs: number, tz: string) {
  const day = dayLabel(p.start.unixMs, nowMs, tz)
  return day === 'Today' ? 'Tonight' : `${day}, ${formatDate(p.start.unixMs, tz).split(', ')[1]}`
}

function sunsetFor(p: ForecastPass, nights: readonly NightSky[], tz: string) {
  const isEvening = passPeriod(p, tz) !== 'before-dawn'
  const night = nights.find(
    (n) =>
      n.evening.sunsetMs !== null && Math.abs(p.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
  )
  return { isEvening, sunsetAzDeg: night?.evening.sunsetAzDeg ?? null }
}

function BigTime({ ms, timeZone }: { ms: number; timeZone: string }) {
  const { clock, period } = timeParts(ms, timeZone)
  return (
    <p className="tnum mt-1 text-[clamp(4rem,19vw,6.5rem)] leading-[0.95] font-semibold tracking-[-0.035em]">
      {clock}
      <span className="ml-2 text-[0.36em] font-medium tracking-normal text-ink-2">{period}</span>
    </p>
  )
}

function PassAnswer(
  props: Props & { pass: ForecastPass; eyebrow: string; urgent?: boolean; focused?: boolean },
) {
  const { pass, eyebrow, urgent, focused, timeZone, nowMs, nights, onClearFocus, placeName } = props
  const name = stationName(pass.noradId)
  const { isEvening, sunsetAzDeg } = sunsetFor(pass, nights, timeZone)
  const note = endNote(pass)
  const until = pass.start.unixMs - nowMs

  return (
    <section aria-labelledby="answer" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <h1 id="answer" className={`text-base font-medium ${urgent ? 'text-ink' : 'text-ink-2'}`}>
          {eyebrow}
        </h1>
        {focused ? (
          <button
            type="button"
            onClick={onClearFocus}
            className="text-sm text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          >
            Back to tonight
          </button>
        ) : (
          until > 0 && <span className="tnum text-sm text-ink-2">{countdown(until)}</span>
        )}
      </div>
      <BigTime ms={pass.start.unixMs} timeZone={timeZone} />
      <p className="mt-3 text-lg">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-2.5 rounded-full bg-station align-[0.1em]"
        />
        <span className="font-semibold">{name.long[0]?.toUpperCase() + name.long.slice(1)}</span>
      </p>
      <p className="mt-2 max-w-[36ch] text-xl leading-snug text-pretty">{pathSentence(pass)}</p>

      <ul className="mt-6 space-y-2.5 text-[1.0625rem] text-ink-2">
        <Cue>{startCue(pass, sunsetAzDeg, isEvening)}</Cue>
        <Cue>
          {brightnessSentence(pass.brightestMagnitude)} Visible for about{' '}
          {minutesLabel(pass.end.unixMs - pass.start.unixMs)}.
        </Cue>
        {note && <Cue>{note}</Cue>}
        {urgent && (
          <Cue>Head outside now and give your eyes a few minutes to adjust to the dark.</Cue>
        )}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <CalendarButton pass={pass} placeName={placeName} timeZone={timeZone} />
        {urgent && (
          <button
            type="button"
            onClick={() => props.onNightMode(!props.nightMode)}
            className="text-sm text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          >
            {props.nightMode ? 'Normal colors' : 'Switch to red night light'}
          </button>
        )}
      </div>
    </section>
  )
}

function LookNow(props: Props & { pass: ForecastPass }) {
  const { pass, nowMs } = props
  const name = stationName(pass.noradId)
  // Where is it right now? Nearest track point.
  const here = pass.track.reduce((a, p) =>
    Math.abs(p.unixMs - nowMs) < Math.abs(a.unixMs - nowMs) ? p : a,
  )
  const left = pass.end.unixMs - nowMs
  return (
    <section aria-labelledby="answer" aria-live="polite">
      <h1 id="answer" className="text-base font-semibold text-station">
        It’s up right now
      </h1>
      <p className="mt-2 text-[clamp(2.5rem,11vw,4rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
        Look {direction(here.azDeg)},{' '}
        <span className="whitespace-nowrap">{fistsLabel(here.elDeg)} up.</span>
      </p>
      <p className="mt-3 text-xl text-ink-2">
        {name.short}: a steady light gliding across the sky, no blinking. About {minutesLabel(left)}{' '}
        left.
      </p>
      <button
        type="button"
        onClick={() => props.onNightMode(!props.nightMode)}
        className="mt-5 text-sm text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
      >
        {props.nightMode ? 'Normal colors' : 'Switch to red night light'}
      </button>
    </section>
  )
}

function NoPass(props: Props & { headline: string; sub: string; next: ForecastPass | null }) {
  const { headline, sub, next, timeZone, nowMs } = props
  return (
    <section aria-labelledby="answer" aria-live="polite">
      <h1
        id="answer"
        className="text-[clamp(2rem,8vw,3rem)] leading-tight font-semibold tracking-[-0.02em] text-balance"
      >
        {headline}
      </h1>
      <p className="mt-3 max-w-[40ch] text-lg text-ink-2">{sub}</p>
      {next && (
        <div className="mt-8">
          <p className="text-base text-ink-2">
            Next good look: {dayLabel(next.start.unixMs, nowMs, timeZone)}
          </p>
          <BigTime ms={next.start.unixMs} timeZone={timeZone} />
          <p className="mt-3 max-w-[36ch] text-lg text-pretty">
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2.5 rounded-full bg-station align-[0.1em]"
            />
            <span className="font-semibold">{stationName(next.noradId).short}.</span>{' '}
            {pathSentence(next)}
          </p>
        </div>
      )}
    </section>
  )
}

function Cue({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[0.875rem_1fr] gap-2">
      <span aria-hidden="true" className="mt-[0.7em] h-px w-2.5 bg-ink-3" />
      <span className="text-pretty">{children}</span>
    </li>
  )
}
