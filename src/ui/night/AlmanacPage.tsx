// The Tonight tab, set like a page of an almanac printed for your town:
// a running head, tonight's answer in large type (3-second rule), the pass as
// a star-atlas chart beside the directions, then the whole night as a ruled
// table you can open row by row. Family settings (bedtime, simple words)
// shape what the answer headlines and how it's worded (D-032).
// Docs: docs/DESIGN.md#almanac
import { lazy, Suspense, useMemo, useState } from 'react'
import type { Forecast, ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { compass16, compass8 } from '../../engine/describe/describe.ts'
import { passPeriod, passScore } from '../../engine/sky/schedule.ts'
import { WORTH_IT } from '../../lib/state.ts'
import { countdown, dayLabel, formatTime, timeParts, weekdayShort } from '../../lib/format.ts'
import {
  AFTER_BEDTIME,
  brightnessSentence,
  direction,
  endNote,
  fistsLabel,
  METEOR_NOTE,
  meteorPeakLabel,
  meteorRate,
  meteorSentence,
  minutesLabel,
  moonPhaseName,
  NIGHT_COPY,
  pathSentence,
  PLANET_NAMES,
  planetLine,
  startCue,
  stationName,
  whereInSky,
} from '../../copy/en.ts'
import { stationLong, type AnswerModel } from '../Answer.tsx'
import { CalendarButton, TwoWeeksLink } from '../CalendarButton.tsx'
import { bedtimeLabel, type Family } from '../../lib/settings.ts'
import { DataAge } from '../DataAge.tsx'
import { Footer } from '../Chrome.tsx'
import { TakeItOutside } from '../TakeItOutside.tsx'
import { bestOtherThing, buildNight, passKey, type OtherThing, type Stop } from './buildNight.ts'
import { chartLabel, PassChart } from './PassChart.tsx'

const WaveBack = lazy(() => import('../wave/WaveBack.tsx'))

type Props = {
  forecast: Forecast
  model: AnswerModel
  place: Place
  catalog: StarCatalog | null
  nowMs: number
  nightMode: boolean
  onNightMode: (on: boolean) => void
  family: Family
  onFamily: () => void
  onChangePlace: () => void
  onFindIt: () => void
  onPhotograph: (targetId: string) => void
  onWeek: () => void
  onFocus: (p: ForecastPass | null) => void
}

export function AlmanacPage(props: Props) {
  const { forecast, model, place, nowMs, family } = props
  const simple = family.simpleWords
  const tz = place.timeZone
  const focusMs = model.kind === 'focus' ? model.pass?.start.unixMs : undefined
  // Rebuild once a minute, not on every tick of the clock.
  const minute = Math.floor(nowMs / 60_000)
  const night = useMemo(
    () => buildNight(forecast, minute * 60_000, focusMs, family.bedtime),
    [forecast, minute, focusMs, family.bedtime],
  )
  const [wave, setWave] = useState<ForecastPass | null>(null)
  const other = night ? bestOtherThing(night) : null

  const hero = model.pass
  // On a night without a pass, the next one is a footnote, not the headline.
  const heroIsTonight = hero !== null && model.headline === undefined
  const sunsetAz = (p: ForecastPass) =>
    forecast.nights.find(
      (n) => n.evening.sunsetMs !== null && Math.abs(p.start.unixMs - n.evening.sunsetMs) < 36e6,
    )?.evening.sunsetAzDeg ?? null
  const minuteOf = (ms: number) => formatTime(ms, tz).replace(/\s?[AP]M$/, '')

  const later = forecast.passes
    .filter(
      (p) =>
        p.start.unixMs > (night?.endMs ?? nowMs) &&
        passPeriod(p, tz) !== 'before-dawn' &&
        passScore(p) >= WORTH_IT,
    )
    .slice(0, 3)

  const dateHead = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(night?.startMs ?? nowMs)
    .replace(/,/g, '')

  return (
    <main className="mx-auto max-w-[36rem] px-5 pt-[max(env(safe-area-inset-top),14px)] pb-28">
      {/* Running head: where and when this page is for. */}
      <header className="mono flex items-baseline justify-between gap-3 border-b border-ink pb-1.5 text-[0.75rem] text-ink-2">
        <span className="min-w-0 truncate">
          <button
            type="button"
            onClick={props.onChangePlace}
            className="link font-medium text-ink uppercase"
            aria-label={`Location: ${place.name}. Change`}
          >
            {place.name}
          </button>{' '}
          <span className="hidden min-[360px]:inline">{latLon(place)}</span>
        </span>
        <span className="shrink-0 uppercase">{dateHead}</span>
      </header>
      <p className="mono mt-1.5 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[0.75rem] text-ink-3">
        <button
          type="button"
          onClick={props.onFamily}
          aria-label={`Family settings: bedtime ${bedtimeLabel(family.bedtime)}, simple words ${simple ? 'on' : 'off'}`}
          className="link"
        >
          Bedtime {bedtimeLabel(family.bedtime)}
          {simple ? ' · simple words' : ''}
        </button>
        <button
          type="button"
          onClick={() => props.onNightMode(!props.nightMode)}
          aria-pressed={props.nightMode}
          aria-label="Red light: dim red keeps your eyes adjusted to the dark"
          className="link"
        >
          Red light {props.nightMode ? 'on' : 'off'}
        </button>
      </p>

      {/* 1. The answer. */}
      <section aria-labelledby="answer" className="mt-4">
        <h1 id="answer" className="mono-caps text-ink-2">
          {model.kind === 'look-now' ? 'Up right now' : model.eyebrow}
          {hero && heroIsTonight && (
            <span className="mt-0.5 block text-ink">{stationLong(hero.noradId)}</span>
          )}
        </h1>

        {model.headline && (
          <p className="serif mt-3 text-[clamp(3.25rem,15vw,4.75rem)] leading-[0.95] text-balance">
            {model.headline}
          </p>
        )}

        {hero && !heroIsTonight ? (
          <>
            {other && model.kind === 'not-tonight' && (
              <UpInstead
                thing={other}
                tz={tz}
                onFindIt={props.onFindIt}
                onPhotograph={props.onPhotograph}
              />
            )}
            <p className="serif-i mt-3 text-[1.375rem] leading-snug text-ink-2">{model.sub}</p>
            <button
              type="button"
              onClick={() => props.onFocus(hero)}
              className="mono mt-5 block text-left text-[0.875rem]"
            >
              <span className="text-ink-3">Next · </span>
              <span className="link text-station">
                {dayLabel(hero.start.unixMs, nowMs, tz)} {formatTime(hero.start.unixMs, tz)} ·{' '}
                {stationName(hero.noradId).short} →
              </span>
            </button>
          </>
        ) : hero ? (
          <>
            <BigTime ms={hero.start.unixMs} tz={tz} />
            {hero.start.unixMs > nowMs && dayLabel(hero.start.unixMs, nowMs, tz) === 'Today' && (
              <p className="mono mt-2 text-[0.8125rem] text-ink-2">
                {countdown(hero.start.unixMs - nowMs)}
              </p>
            )}
            <p className="serif-i mt-4 text-[1.5rem] leading-[1.18] text-pretty">
              <Emphasised text={pathSentence(hero, simple)} />
            </p>

            <div className="mt-6 grid grid-cols-1 items-start gap-4 min-[340px]:grid-cols-[150px_1fr]">
              <PassChart
                pass={hero}
                sunsetAzDeg={passPeriod(hero, tz) === 'before-dawn' ? null : sunsetAz(hero)}
                formatMinute={minuteOf}
                label={chartLabel(hero)}
              />
              <Directions
                pass={hero}
                sunsetAz={sunsetAz(hero)}
                dawn={passPeriod(hero, tz) === 'before-dawn'}
                simple={simple}
              />
            </div>

            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[1rem]">
              <button type="button" onClick={props.onFindIt} className="link text-station">
                Find it in the sky →
              </button>
              <CalendarButton pass={hero} placeName={place.name} timeZone={tz} />
              <button type="button" onClick={() => setWave(hero)} className="link">
                Their view
              </button>
            </p>
            {model.kind === 'focus' && (
              <button
                type="button"
                onClick={() => props.onFocus(null)}
                className="link mono mt-4 block text-[0.8125rem] text-ink-2"
              >
                ← Back to tonight
              </button>
            )}
          </>
        ) : (
          <>
            {other && (
              <UpInstead
                thing={other}
                tz={tz}
                onFindIt={props.onFindIt}
                onPhotograph={props.onPhotograph}
              />
            )}
            <p className="serif-i mt-3 text-[1.375rem] text-ink-2">
              No good passes in the next week{other ? '.' : '. A quiet sky tonight.'}
            </p>
          </>
        )}
        {model.late && (
          <LateNote pass={model.late} tz={tz} onOpen={() => props.onFocus(model.late ?? null)} />
        )}
      </section>

      {/* 2. The night, as a ruled table. */}
      {night && (
        <section aria-labelledby="the-night" className="mt-10">
          <h2
            id="the-night"
            className="mono-caps flex justify-between border-b border-ink pb-1.5 text-ink-2"
          >
            <span>{nightTitle(night.startMs, nowMs, tz)}</span>
            <span className="text-ink-3">Tap a line</span>
          </h2>
          <ul>
            {night.stops.map((s) => (
              <li key={s.id} className="border-b border-rule">
                <StopRow
                  stop={s}
                  tz={tz}
                  placeName={place.name}
                  nowMs={nowMs}
                  sunsetAz={night.night.evening.sunsetAzDeg}
                  minuteOf={minuteOf}
                  simple={simple}
                  onWave={setWave}
                  onFindIt={props.onFindIt}
                  onPhotograph={props.onPhotograph}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. The next good evenings. */}
      <section aria-labelledby="later" className="mt-10">
        <h2 id="later" className="mono-caps border-b border-ink pb-1.5 text-ink-2">
          Later this week
        </h2>
        <ul>
          {later.map((p) => (
            <li key={passKey(p)} className="border-b border-rule">
              <button
                type="button"
                onClick={() => props.onFocus(p)}
                className="grid w-full grid-cols-[4.25rem_1fr_auto] items-baseline gap-3 py-2.5 text-left"
              >
                <span className="mono text-[0.8125rem] text-ink-2">
                  {weekdayShort(p.start.unixMs, tz)} {minuteOf(p.start.unixMs)}
                </span>
                <span className="text-station">{stationName(p.noradId).short}</span>
                <span className="mono text-[0.75rem] text-ink-3">
                  {compass8(p.start.azDeg)}→{compass8(p.end.azDeg)}
                </span>
              </button>
            </li>
          ))}
          {!later.length && (
            <li className="border-b border-rule py-2.5 text-ink-2">
              No more good evening passes this week.
            </li>
          )}
        </ul>
        <button type="button" onClick={props.onWeek} className="link mt-4 block text-[1rem]">
          Every pass this week →
        </button>
        <TwoWeeksLink
          passes={forecast.passes}
          placeName={place.name}
          timeZone={tz}
          bedtime={family.bedtime}
          nowMs={nowMs}
        />
      </section>

      <div className="mt-10 space-y-8">
        {hero && (
          <DataAge
            epochMs={forecast.elements.find((e) => e.noradId === hero.noradId)?.epochMs ?? nowMs}
            nowMs={nowMs}
          />
        )}
        <TakeItOutside />
      </div>
      <Footer />

      {wave && (
        <Suspense fallback={null}>
          <WaveBack
            pass={wave}
            place={place}
            catalog={props.catalog}
            red={props.nightMode}
            onClose={() => setWave(null)}
          />
        </Suspense>
      )}
    </main>
  )
}

function latLon(p: Place): string {
  const lat = `${Math.abs(p.latDeg).toFixed(2)}°${p.latDeg >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(p.lonDeg).toFixed(2)}°${p.lonDeg >= 0 ? 'E' : 'W'}`
  return `${lat} ${lon}`
}

function nightTitle(startMs: number, nowMs: number, tz: string): string {
  const d = dayLabel(startMs, nowMs, tz)
  return d === 'Today' ? 'Tonight, hour by hour' : `${d} night, hour by hour`
}

/** The time as the page's headline: serif figures, a small italic "pm". */
export function BigTime({ ms, tz }: { ms: number; tz: string }) {
  const { clock, period } = timeParts(ms, tz)
  return (
    <p className="serif tnum mt-2 -ml-1 text-[clamp(6rem,35vw,9rem)] leading-[0.82] tracking-[-0.02em]">
      <span>{clock}</span>
      {period && (
        <span className="serif-i ml-1.5 text-[0.26em] tracking-normal text-ink-2">
          {period.toLowerCase()}
        </span>
      )}
    </p>
  )
}

/** The part of the path sentence that makes a pass worth it, in amber. */
function Emphasised({ text }: { text: string }) {
  const m =
    /(passes straight overhead|almost straight overhead|(?:almost )?right over your head|high in the [a-z-]+)/.exec(
      text,
    )
  if (!m) return <>{text}</>
  const i = m.index
  return (
    <>
      {text.slice(0, i)}
      <em className="text-station">{m[0]}</em>
      {text.slice(i + m[0].length)}
    </>
  )
}

function Directions({
  pass: p,
  sunsetAz,
  dawn,
  simple = false,
}: {
  pass: ForecastPass
  sunsetAz: number | null
  dawn: boolean
  simple?: boolean
}) {
  const note = endNote(p, simple)
  return (
    <div className="space-y-2 text-[0.9375rem] leading-snug text-ink-2">
      <p>{startCue(p, sunsetAz, !dawn, simple)}</p>
      <p>
        {brightnessSentence(p.brightestMagnitude, simple)} About{' '}
        {minutesLabel(p.end.unixMs - p.start.unixMs)}.
      </p>
      {note && <p>{note}</p>}
    </div>
  )
}

function stopTitle(s: Stop): string {
  switch (s.kind) {
    case 'sunset':
      return 'Sunset'
    case 'dark':
      return 'First stars'
    case 'pass':
      return stationName(s.pass.noradId).short
    case 'moon':
      return 'The Moon'
    case 'planet':
      return PLANET_NAMES[s.planet.id] ?? s.planet.id
    case 'meteor':
      return s.shower.name
    case 'sunrise':
      return 'Sunrise'
  }
}

/** The right-hand column: one figure that says the most about the line. */
function stopFigure(s: Stop): string {
  switch (s.kind) {
    case 'sunset':
      return compass16(s.face.azDeg)
    case 'pass':
      return `${compass16(s.pass.start.azDeg)}→${compass16(s.pass.end.azDeg)}`
    case 'moon':
      return `${Math.round(s.moon.illumination * 100)}% lit`
    case 'planet':
      return `${compass16(s.planet.azDeg)} ${fistsLabel(s.planet.elDeg)}`
    case 'meteor':
      return meteorRate(s.shower.rateLow, s.shower.rateHigh)
    default:
      return ''
  }
}

function stopSubtitle(s: Stop): string | null {
  if (s.kind === 'pass')
    return s.dawn ? 'early risers' : s.late ? AFTER_BEDTIME : s.weak ? 'low or faint' : null
  if (s.kind === 'planet') return 'highest'
  // Only near the peak is it worth a word on the line; the detail says the rest.
  if (s.kind === 'meteor')
    return Math.abs(s.shower.peakInDays) <= 1 ? meteorPeakLabel(s.shower.peakInDays) : null
  return null
}

function StopRow({
  stop: s,
  tz,
  placeName,
  nowMs,
  sunsetAz,
  minuteOf,
  simple,
  onWave,
  onFindIt,
  onPhotograph,
}: {
  stop: Stop
  tz: string
  placeName: string
  nowMs: number
  sunsetAz: number | null
  minuteOf: (ms: number) => string
  simple: boolean
  onWave: (p: ForecastPass) => void
  onFindIt: () => void
  onPhotograph: (id: string) => void
}) {
  // Passes after bedtime keep their line but drop the station's amber.
  const station = s.kind === 'pass' && !s.late
  const sub = stopSubtitle(s)
  const line = (
    <span
      className={`grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-3 py-2.5 ${station ? 'text-station' : ''}`}
    >
      <span className={`mono text-[0.8125rem] ${station ? '' : 'text-ink-2'}`}>
        {minuteOf(s.atMs)}
      </span>
      <span>
        {stopTitle(s)}
        {sub && <span className="serif-i text-ink-3"> {sub}</span>}
      </span>
      <span className={`mono text-[0.6875rem] ${station ? '' : 'text-ink-3'}`}>
        {stopFigure(s)}
      </span>
    </span>
  )
  if (s.kind === 'sunrise') return line

  return (
    <details className="group">
      <summary
        className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        aria-label={`${stopTitle(s)}, ${formatTime(s.atMs, tz)}`}
      >
        {line}
      </summary>
      <div className="pb-4 pl-[4rem] text-[0.9375rem] leading-snug text-ink-2">
        {s.kind === 'pass' ? (
          <>
            <p className="text-ink">{pathSentence(s.pass, simple)}</p>
            <div className="mt-3 space-y-3">
              <PassChart
                pass={s.pass}
                size={140}
                sunsetAzDeg={s.dawn ? null : sunsetAz}
                formatMinute={minuteOf}
                label={chartLabel(s.pass)}
              />
              <Directions pass={s.pass} sunsetAz={sunsetAz} dawn={s.dawn} simple={simple} />
            </div>
            {s.weak && <p className="mt-2">{NIGHT_COPY.weakPass}</p>}
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-ink">
              <button type="button" onClick={() => onWave(s.pass)} className="link">
                Their view
              </button>
              {s.pass.end.unixMs > nowMs && (
                <CalendarButton pass={s.pass} placeName={placeName} timeZone={tz} />
              )}
            </p>
          </>
        ) : s.kind === 'meteor' ? (
          <>
            <p>
              {capitalise(meteorPeakLabel(s.shower.peakInDays))}. {meteorSentence(s.shower)}
            </p>
            <p className="mt-2 text-[0.8125rem] text-ink-3">{METEOR_NOTE}</p>
          </>
        ) : s.kind === 'moon' || s.kind === 'planet' ? (
          <>
            <p>
              {s.kind === 'moon'
                ? `${moonPhaseName(s.moon.illumination, s.moon.waxing)}. ${capitalise(whereInSky(s.moon.azDeg, s.moon.elDeg))}.`
                : `${capitalise(whereInSky(s.planet.azDeg, s.planet.elDeg))}. ${planetLine(s.planet.magnitude)}`}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-ink">
              <button
                type="button"
                onClick={() => onPhotograph(s.kind === 'moon' ? 'moon' : s.planet.id)}
                className="link"
              >
                Photograph
              </button>
              <button type="button" onClick={onFindIt} className="link">
                Find it
              </button>
            </p>
          </>
        ) : (
          <p>
            {s.kind === 'sunset' ? NIGHT_COPY.sunset(direction(s.face.azDeg)) : NIGHT_COPY.dark}
          </p>
        )}
      </div>
    </details>
  )
}

const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** A better pass after bedtime: a footnote, never the headline. */
function LateNote({ pass, tz, onOpen }: { pass: ForecastPass; tz: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mono mt-5 block text-left text-[0.8125rem]">
      <span className="text-ink-3">After bedtime · </span>
      <span className="link text-ink-2">
        {formatTime(pass.start.unixMs, tz).toLowerCase()} · {stationName(pass.noradId).short},{' '}
        {fistsLabel(pass.peak.elDeg)} up →
      </span>
    </button>
  )
}

/** On a night without a good pass: the best other thing to step out for. */
function UpInstead({
  thing,
  tz,
  onFindIt,
  onPhotograph,
}: {
  thing: OtherThing
  tz: string
  onFindIt: () => void
  onPhotograph: (id: string) => void
}) {
  const s = thing.stop
  const title = stopTitle(s)
  const line =
    s.kind === 'moon'
      ? `${moonPhaseName(s.moon.illumination, s.moon.waxing)}, ${whereInSky(s.moon.azDeg, s.moon.elDeg)}.`
      : s.kind === 'planet'
        ? `${capitalise(whereInSky(s.planet.azDeg, s.planet.elDeg))}. ${planetLine(s.planet.magnitude)}`
        : meteorSentence(s.shower)
  const photo = s.kind === 'moon' ? 'moon' : s.kind === 'planet' ? s.planet.id : null
  return (
    <div className="mt-6 border-y border-rule py-4">
      <p className="mono-caps text-ink-3">Up instead</p>
      <p className="serif mt-1 text-[2.25rem] leading-none">
        {title}
        <span className="serif-i text-[0.6em] text-ink-2">
          {' '}
          {s.kind === 'moon' ? 'at' : s.kind === 'planet' ? 'highest at' : 'best at'}{' '}
          {formatTime(s.atMs, tz).toLowerCase()}
        </span>
      </p>
      <p className="mt-2 text-[0.9375rem] leading-snug text-ink-2">{line}</p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" onClick={onFindIt} className="link">
          Find it
        </button>
        {photo && (
          <button type="button" onClick={() => onPhotograph(photo)} className="link">
            Photograph
          </button>
        )}
      </p>
    </div>
  )
}
