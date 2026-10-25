// Aircraft-style heading tape: the compass as a ribbon that slides as you
// turn. Ticks every 5°, numbers every 15°, cardinal letters, and a marker
// for the target's bearing when it's in range.
import { compass16 } from '../../engine/describe/describe.ts'

const SPAN = 70 // degrees shown across the tape

export function HeadingTape({
  headingDeg,
  targetAzDeg,
  elDeg,
}: {
  headingDeg: number
  targetAzDeg: number | null
  elDeg: number
}) {
  const ticks: number[] = []
  const start = Math.floor((headingDeg - SPAN / 2) / 5) * 5
  for (let d = start; d <= headingDeg + SPAN / 2; d += 5) ticks.push(d)
  const x = (d: number) => `${50 + ((d - headingDeg) / SPAN) * 100}%`
  let rel: number | null = null
  if (targetAzDeg !== null) {
    rel = targetAzDeg - headingDeg
    if (rel > 180) rel -= 360
    if (rel < -180) rel += 360
  }
  const norm = (d: number) => ((d % 360) + 360) % 360
  const label = (d: number) => {
    const n = norm(d)
    if (n % 45 === 0) return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][n / 45]
    return n % 15 === 0 ? String(n) : null
  }
  return (
    <div className="pointer-events-none relative h-11 select-none" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
        {ticks.map((d) => {
          const l = label(d)
          return (
            <div key={d} className="absolute top-0 -translate-x-1/2" style={{ left: x(d) }}>
              <div className={`mx-auto w-px ${l ? 'h-3 bg-white/80' : 'h-1.5 bg-white/45'}`} />
              {l && (
                <div
                  className={`hud mt-0.5 text-center text-[11px] ${/[A-Z]/.test(l) ? 'font-bold text-white' : 'text-white/70'} ${l === 'N' ? 'text-station' : ''}`}
                >
                  {l}
                </div>
              )}
            </div>
          )
        })}
        {rel !== null && Math.abs(rel) < SPAN / 2 && (
          <div
            className="absolute top-0 h-3 w-1.5 -translate-x-1/2 rounded-b-sm bg-station"
            style={{ left: x(headingDeg + rel) }}
          />
        )}
      </div>
      {/* Centre readout */}
      <div className="absolute top-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div className="h-3 w-0.5 bg-station" />
      </div>
      <div className="hud absolute top-7 left-1/2 -translate-x-1/2 rounded-sm bg-black/55 px-1.5 text-[13px] font-semibold text-white">
        {String(Math.round(norm(headingDeg))).padStart(3, '0')}° {compass16(norm(headingDeg))}
        <span className="ml-2 font-medium text-white/60">ALT {Math.round(elDeg)}°</span>
      </div>
      {rel !== null && Math.abs(rel) >= SPAN / 2 && (
        <div
          className={`hud absolute top-1 text-[11px] font-semibold text-station ${rel > 0 ? 'right-1' : 'left-1'}`}
        >
          {rel > 0 ? `${Math.round(rel)}° ›` : `‹ ${Math.round(-rel)}°`}
        </div>
      )}
    </div>
  )
}
