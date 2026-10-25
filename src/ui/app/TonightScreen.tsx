// The home tab: tonight's best pass as a hero card drawn from the real sky,
// what else is up (with photos), how to see it, which way to look, and the
// week ahead. Every card is real data for this place and night.
// Docs: docs/DESIGN.md
import { useMemo } from 'react'
import type { Forecast, ForecastPass } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import type { Landmark } from '../../engine/sky/scene.ts'
import { skyScene } from '../../engine/sky/scene.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { passPeriod, passScore } from '../../engine/sky/schedule.ts'
import { WORTH_IT } from '../../lib/state.ts'
import { compass8 } from '../../engine/describe/describe.ts'
import { direction, minutesLabel, stationName } from '../../copy/en.ts'
import {
  countdown,
  dayLabel,
  formatTime,
  timeParts,
  weekdayShort,
  dayOfMonth,
} from '../../lib/format.ts'
import { HowToSee, stationLong, type AnswerModel } from '../Answer.tsx'
import { CompassCard } from '../CompassCard.tsx'
import { TonightStrip, passKey } from '../TonightStrip.tsx'
import { DataAge } from '../DataAge.tsx'
import { CalendarButton } from '../CalendarButton.tsx'
import { Footer } from '../Chrome.tsx'
import { Logo } from '../../brand/Logo.tsx'
import { SkyThumb } from './SkyThumb.tsx'
import { targetsFor, type Target } from '../../photo/targets.ts'
import { IconArrow, IconCamera, IconPin, IconRed } from './Icons.tsx'

type Photo = { src: string; credit: string }
const STAR_PHOTO: Photo = { src: '/img/milkyway.webp', credit: 'NASA (ISS crew)' }
const ISS_PHOTO: Photo = { src: '/img/iss.webp', credit: 'NASA (Expedition 56 crew)' }
const PHOTO: Record<string, Photo> = {
  moon: { src: '/img/moon.webp', credit: 'NASA/GSFC (LRO)' },
  saturn: { src: '/img/saturn.webp', credit: 'NASA/JPL/Space Science Institute' },
  jupiter: { src: '/img/jupiter.webp', credit: 'NASA/JPL/Space Science Institute' },
  mars: { src: '/img/mars.webp', credit: 'NASA/JPL/USGS' },
  venus: { src: '/img/venus.webp', credit: 'NASA/JPL-Caltech' },
  star: { src: '/img/milkyway.webp', credit: 'NASA (ISS crew)' },
  iss: { src: '/img/iss.webp', credit: 'NASA (Expedition 56 crew)' },
}

type Props = {
  forecast: Forecast
  model: AnswerModel
  place: Place
  catalog: StarCatalog | null
  landmark: Landmark | null
  nowMs: number
  nightMode: boolean
  onNightMode: (on: boolean) => void
  onChangePlace: () => void
  onFindIt: () => void
  onPhotograph: (targetId: string | null) => void
  onSeeAllPasses: () => void
  onFocus: (p: ForecastPass | null) => void
}

export function TonightScreen(props: Props) {
  const { forecast, model, place, catalog, landmark, nowMs } = props
  const tz = place.timeZone
  const pass = model.pass
  const tonight = forecast.nights[0]
  const night =
    forecast.nights.find(
      (n) =>
        pass &&
        n.evening.sunsetMs !== null &&
        Math.abs(pass.start.unixMs - n.evening.sunsetMs) < 10 * 3_600_000,
    ) ?? tonight

  // "Up tonight": what's in the sky once it's properly dark (or now, if it already is).
  const viewMs = useMemo(() => {
    const dusk = tonight?.evening.civilDuskMs
    return dusk && nowMs < dusk ? dusk + 90 * 60_000 : nowMs
  }, [tonight, nowMs])
  const upTonight = useMemo(() => {
    const t = Math.floor(viewMs / 60_000) * 60_000
    return targetsFor(skyScene(place, t, catalog), catalog, [], t).filter((x) => x.kind !== 'trail')
  }, [place, catalog, viewMs])

  const upcoming = forecast.passes
    .filter(
      (p) =>
        p.end.unixMs > nowMs && passPeriod(p, tz) !== 'before-dawn' && passScore(p) >= WORTH_IT,
    )
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-md px-4 pb-32 wide:max-w-5xl">
      {/* Header */}
      <header className="flex items-center justify-between pt-[max(env(safe-area-inset-top),16px)] pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-surface-2 ring-1 ring-hair">
            <Logo size={30} title="" />
          </span>
          <div>
            <p className="display text-[1.0625rem] leading-tight">Look up tonight</p>
            <button
              type="button"
              onClick={props.onChangePlace}
              className="flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ink"
              aria-label={`Location: ${place.name}. Change`}
            >
              <IconPin className="size-3.5 shrink-0" />
              <span className="max-w-[11rem] truncate">{place.name}</span>
              <span className="text-action">· Change</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => props.onNightMode(!props.nightMode)}
          aria-pressed={props.nightMode}
          title="Night vision: dim red light keeps your eyes adjusted to the dark"
          className={`flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold ring-1 ring-hair ${props.nightMode ? 'bg-action text-action-ink' : 'bg-surface-2 text-ink-2'}`}
        >
          <IconRed className="size-4.5" />
          Night vision
        </button>
      </header>
      {props.nightMode && (
        <p className="-mt-1 mb-3 text-[0.8125rem] text-ink-2">
          Night vision is on: dim red light doesn’t spoil your eyes’ adjustment to the dark (it
          takes ~30 minutes to fully adapt). Tap it again for normal colours.
        </p>
      )}

      <div className="wide:grid wide:grid-cols-[1.15fr_1fr] wide:gap-6">
        <div>
          {/* Hero */}
          <section aria-labelledby="answer" className="card relative overflow-hidden">
            {pass ? (
              <SkyThumb
                pass={pass}
                place={place}
                catalog={catalog}
                red={props.nightMode}
                horizonAt={0.68}
                className="block h-[17rem] w-full"
                label={`The sky facing ${direction(pass.start.azDeg)} with the path of ${stationName(pass.noradId).short}, minute by minute.`}
              />
            ) : (
              <div className="h-[17rem] bg-[linear-gradient(to_top,var(--surface-2),var(--night))]" />
            )}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
              <span className="display rounded-full bg-black/45 px-3 py-1 text-[0.75rem] tracking-wide text-ink backdrop-blur">
                {model.kind === 'look-now'
                  ? 'Up right now'
                  : model.kind === 'focus'
                    ? 'Selected pass'
                    : 'Tonight’s best'}
              </span>
              {pass && pass.start.unixMs > nowMs && (
                <span className="display rounded-full bg-black/45 px-3 py-1 text-[0.75rem] text-station backdrop-blur">
                  {countdown(pass.start.unixMs - nowMs)}
                </span>
              )}
            </div>
            <div className="relative -mt-24 bg-gradient-to-t from-surface via-surface/95 to-transparent px-5 pt-10 pb-5">
              <h1 id="answer" className="text-[0.8125rem] font-medium text-ink-2">
                {model.eyebrow}
              </h1>
              {model.headline && <p className="display mt-1 mb-2 text-xl">{model.headline}</p>}
              {pass && (
                <>
                  <BigTime ms={pass.start.unixMs} tz={tz} />
                  <p className="mt-1 flex items-center gap-2 text-[0.9375rem]">
                    <span aria-hidden="true" className="size-2.5 rounded-full bg-station" />
                    <span className="font-semibold">{stationLong(pass.noradId)}</span>
                  </p>
                  <dl className="mt-4 grid grid-cols-4 gap-2">
                    <Stat term="Height" value={`${Math.round(pass.peak.elDeg)}°`} />
                    <Stat
                      term="Brightness"
                      value={`${pass.brightestMagnitude < 0 ? '−' : ''}${Math.abs(pass.brightestMagnitude).toFixed(1)}`}
                    />
                    <Stat term="Lasts" value={minutesLabel(pass.end.unixMs - pass.start.unixMs)} />
                    <Stat
                      term="Path"
                      value={`${compass8(pass.start.azDeg)}→${compass8(pass.end.azDeg)}`}
                    />
                  </dl>
                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={props.onFindIt}
                      className="display flex items-center justify-center gap-2 rounded-2xl bg-action py-3.5 text-[0.9375rem] text-action-ink"
                    >
                      Find it in the sky <IconArrow className="size-4" />
                    </button>
                    <CalendarButton pass={pass} placeName={place.name} timeZone={tz} />
                  </div>
                  {model.kind === 'focus' && (
                    <button
                      type="button"
                      onClick={() => props.onFocus(null)}
                      className="mt-3 text-sm text-ink-2 underline underline-offset-4"
                    >
                      Back to tonight
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Up tonight */}
          <SectionHead
            title="Up tonight"
            action={
              upTonight.length
                ? { label: 'Photograph', onClick: () => props.onPhotograph(null) }
                : null
            }
          />
          {upTonight.length ? (
            <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {upTonight.map((t) => (
                <ObjectCard
                  key={t.id}
                  target={t}
                  timeLabel={formatTime(viewMs, tz)}
                  onPhotograph={() => props.onPhotograph(t.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="card p-4 text-ink-2">
              Nothing bright is up this evening. Check back tomorrow.
            </p>
          )}

          {pass && (
            <>
              <SectionHead title="How to see it" />
              <div className="card p-5">
                <HowToSee pass={pass} nights={forecast.nights} landmark={landmark} timeZone={tz} />
                <div className="mt-5 border-t border-hair pt-4">
                  <DataAge
                    epochMs={
                      forecast.elements.find((e) => e.noradId === pass.noradId)?.epochMs ?? nowMs
                    }
                    nowMs={nowMs}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          {pass && night && (
            <>
              <SectionHead title="Which way to look" className="wide:mt-0" />
              <div className="card p-5">
                <CompassCard
                  pass={pass}
                  place={place}
                  sunsetAzDeg={night.evening.sunsetAzDeg}
                  nowMs={nowMs}
                  titleHidden
                />
              </div>
            </>
          )}

          <SectionHead
            title="Coming up"
            action={{ label: 'All passes', onClick: props.onSeeAllPasses }}
          />
          <ul className="space-y-2.5">
            {upcoming.map((p) => (
              <li key={passKey(p)}>
                <PassRow
                  pass={p}
                  place={place}
                  catalog={catalog}
                  nowMs={nowMs}
                  onOpen={() => props.onFocus(p)}
                />
              </li>
            ))}
            {!upcoming.length && (
              <li className="card p-4 text-ink-2">No good evening passes this week.</li>
            )}
          </ul>

          {tonight && (
            <>
              <SectionHead title="Tonight’s timeline" />
              <div className="card p-5">
                <TonightStrip
                  evening={tonight.evening}
                  passes={forecast.passes}
                  timeZone={tz}
                  bedtime="21:30"
                  selectedKey={pass ? passKey(pass) : undefined}
                  titleHidden
                />
              </div>
            </>
          )}

          <SectionHead title="Behind the numbers" />
          <a
            href="https://github.com/IJai-code/skypassalert/blob/main/docs/accuracy/phase2.md"
            className="card relative block overflow-hidden"
          >
            <img
              src="/img/milkyway.webp"
              alt=""
              width={720}
              height={410}
              loading="lazy"
              className="h-36 w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
            <div className="relative -mt-16 p-5">
              <p className="display text-lg">Checked against professional software</p>
              <p className="mt-1 text-sm text-ink-2">
                Positions agree with Skyfield to within 15 m; pass times with Heavens-Above to
                within 2 s.
              </p>
            </div>
            <p className="px-5 pb-3 text-[10px] text-ink-3">Photo: NASA (ISS crew)</p>
          </a>
        </div>
      </div>

      <Footer />
    </div>
  )
}

function BigTime({ ms, tz }: { ms: number; tz: string }) {
  const { clock, period } = timeParts(ms, tz)
  return (
    <p className="display tnum mt-0.5 text-[4.25rem] leading-[0.95] tracking-[-0.03em]">
      {clock}
      <span className="ml-1.5 text-[1.25rem] font-semibold tracking-normal text-ink-2">
        {period}
      </span>
    </p>
  )
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2.5 py-2 ring-1 ring-hair">
      <dt className="text-[0.6875rem] text-ink-3">{term}</dt>
      <dd className="display tnum mt-0.5 text-[0.9375rem] whitespace-nowrap">{value}</dd>
    </div>
  )
}

function SectionHead({
  title,
  action,
  className,
}: {
  title: string
  action?: { label: string; onClick: () => void } | null
  className?: string
}) {
  return (
    <div className={`mt-8 mb-3 flex items-baseline justify-between ${className ?? ''}`}>
      <h2 className="display text-[1.1875rem]">{title}</h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-[0.8125rem] font-semibold text-action"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function ObjectCard({
  target,
  timeLabel,
  onPhotograph,
}: {
  target: Target
  timeLabel: string
  onPhotograph: () => void
}) {
  const photo = (target.kind === 'stars' ? STAR_PHOTO : PHOTO[target.id]) ?? STAR_PHOTO
  return (
    <li className="card relative w-40 shrink-0 snap-start overflow-hidden">
      <img src={photo.src} alt="" loading="lazy" className="h-36 w-full object-cover" />
      <div className="absolute inset-x-0 top-24 h-12 bg-gradient-to-t from-surface to-transparent" />
      <div className="relative px-3 pb-3">
        <p className="display text-[1rem]">{target.name}</p>
        <p className="mt-0.5 text-[0.75rem] text-ink-2">
          {compass8(target.azDeg)}, {Math.round(target.elDeg)}° up · {timeLabel}
        </p>
        <button
          type="button"
          onClick={onPhotograph}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] py-2 text-[0.8125rem] font-semibold text-action ring-1 ring-hair"
        >
          <IconCamera className="size-4" /> Photograph
        </button>
        <p className="mt-1.5 truncate text-[9px] text-ink-3">Photo: {photo.credit}</p>
      </div>
    </li>
  )
}

export function PassRow({
  pass,
  place,
  catalog,
  nowMs,
  onOpen,
  trailing,
}: {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  nowMs: number
  onOpen: () => void
  trailing?: React.ReactNode
}) {
  const tz = place.timeZone
  return (
    <div className="card flex items-center gap-3 p-2.5 pr-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
          {pass.noradId === 25544 ? (
            <img src={ISS_PHOTO.src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <SkyThumb
              pass={pass}
              place={place}
              catalog={catalog}
              labels={false}
              horizonAt={0.8}
              className="block h-full w-full"
              label=""
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.75rem] text-ink-3">
            {dayLabel(pass.start.unixMs, nowMs, tz)} · {weekdayShort(pass.start.unixMs, tz)}{' '}
            {dayOfMonth(pass.start.unixMs, tz)}
          </p>
          <p className="display tnum text-[1.1875rem] leading-tight">
            {formatTime(pass.start.unixMs, tz)}{' '}
            <span className="text-[0.875rem] font-semibold text-ink-2">
              {stationName(pass.noradId).short}
            </span>
          </p>
          <p className="text-[0.75rem] text-ink-2">
            {Math.round(pass.peak.elDeg)}° high · {compass8(pass.start.azDeg)}→
            {compass8(pass.end.azDeg)} · {minutesLabel(pass.end.unixMs - pass.start.unixMs)}
          </p>
        </div>
      </button>
      {trailing}
    </div>
  )
}
