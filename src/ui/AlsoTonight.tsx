// The rest of tonight's sky: the Moon and naked-eye planets. On nights with
// no station pass, this is the reason to step outside anyway.
import type { NightSky } from '../engine/index.ts'
import { direction } from '../copy/en.ts'
import { formatTime } from '../lib/format.ts'
import type { PlanetId } from '../engine/planets/planets.ts'

const NAMES: Record<PlanetId, string> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
}

function moonPhaseWords(illum: number, waxing: boolean): string {
  if (illum > 0.97) return 'Full Moon'
  if (illum < 0.03) return 'New Moon (not visible)'
  const shape = illum < 0.45 ? 'crescent' : illum <= 0.55 ? 'half Moon' : 'gibbous Moon'
  return `${waxing ? 'Growing' : 'Shrinking'} ${shape}, ${Math.round(illum * 100)}% lit`
}

function planetWords(mag: number): string {
  if (mag <= -3) return 'brilliant'
  if (mag <= -1.5) return 'very bright'
  if (mag <= 0.5) return 'bright'
  return 'easy to find'
}

export function AlsoTonight({ night, timeZone }: { night: NightSky; timeZone: string }) {
  const { moon, planets } = night
  return (
    <section aria-labelledby="also" className="mt-12">
      <h2 id="also" className="label">
        Also in tonight’s sky
      </h2>
      <dl className="mt-3 border-t border-hair">
        <Row term="Moon">
          {moonPhaseWords(moon.illumination, moon.waxing)}
          {moon.illumination >= 0.03 &&
            (moon.elDeg > 5
              ? `, in the ${direction(moon.azDeg)} after dark.`
              : ', below the horizon after dark.')}
        </Row>
        {planets.map((p) => (
          <Row key={p.id} term={NAMES[p.id]}>
            {planetWords(p.magnitude)[0]?.toUpperCase() + planetWords(p.magnitude).slice(1)}, in the{' '}
            {direction(p.azDeg)}, highest around{' '}
            <span className="tnum">{formatTime(p.bestMs, timeZone)}</span>.
          </Row>
        ))}
      </dl>
      {planets.length > 0 && (
        <p className="mt-3 text-sm text-ink-3">
          Tell planets from stars: planets shine steadily; stars twinkle.
        </p>
      )}
    </section>
  )
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_1fr] gap-3 border-b border-hair py-3">
      <dt className="font-semibold">{term}</dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  )
}
