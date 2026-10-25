// The sky as a circle and a compass: edge = horizon, centre = straight up,
// north at the top (map convention, which non-astronomers read more easily
// than star-chart east-left), with a degree ring. With the phone's compass on,
// the whole dial turns so the direction you face is at the top.
// Everything drawn is computed from the actual pass.
// Docs: docs/DESIGN.md#sky-dome
import { useEffect, useId, useRef, useState } from 'react'
import type { MoonInfo, VisiblePass } from '../engine/index.ts'
import { formatTime } from '../lib/format.ts'
import { prefersReducedMotion } from '../lib/env.ts'

const SIZE = 320
const C = SIZE / 2
const R = 136

/** Azimuth/elevation → SVG point. */
function project(azDeg: number, elDeg: number): [number, number] {
  const r = (R * (90 - Math.max(0, elDeg))) / 90
  const a = (azDeg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)]
}

type Props = {
  pass: VisiblePass
  timeZone: string
  sunsetAzDeg: number | null
  /** The Moon at the pass's peak, drawn if it's above the horizon. */
  moon: MoonInfo | null
  /** When set, draw the station's live position (look-now state). */
  nowMs?: number
  /** Live true heading of the phone (degrees); rotates the dial. */
  headingDeg?: number | null
  className?: string
  children?: React.ReactNode
}

export function SkyDome({
  pass,
  timeZone,
  sunsetAzDeg,
  moon,
  nowMs,
  headingDeg,
  className,
  children,
}: Props) {
  const titleId = useId()
  const track = pass.track.filter((p) => p.elDeg >= 0)
  const brightest = pass.brightestMagnitude
  const [replayT, setReplayT] = useState<number | null>(null)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const replay = () => {
    if (prefersReducedMotion()) return
    cancelAnimationFrame(raf.current)
    const duration = Math.min(7000, Math.max(3500, (pass.end.unixMs - pass.start.unixMs) / 40))
    const t0 = performance.now()
    const tick = (now: number) => {
      const f = (now - t0) / duration
      if (f >= 1) {
        setReplayT(null)
        return
      }
      setReplayT(pass.start.unixMs + f * (pass.end.unixMs - pass.start.unixMs))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const live =
    replayT ??
    (nowMs !== undefined && nowMs >= pass.start.unixMs && nowMs <= pass.end.unixMs ? nowMs : null)
  const livePoint = live === null ? null : interpolate(pass, live)

  const start = project(pass.start.azDeg, pass.start.elDeg)
  const peak = project(pass.peak.azDeg, pass.peak.elDeg)
  const end = project(pass.end.azDeg, pass.end.elDeg)
  const mid = track[Math.floor(track.length / 2)]
  const midNext = track[Math.floor(track.length / 2) + 1]
  const dirAt = (i: number): [number, number] => {
    const a = track[Math.max(0, i - 1)]
    const b = track[Math.min(track.length - 1, i + 1)]
    if (!a || !b) return [1, 0]
    const [x1, y1] = project(a.azDeg, a.elDeg)
    const [x2, y2] = project(b.azDeg, b.elDeg)
    return [x2 - x1, y2 - y1]
  }
  const peakIndex = track.reduce(
    (best, p, i) => (p.elDeg > (track[best]?.elDeg ?? -90) ? i : best),
    0,
  )
  const avoid: Array<[number, number]> = [[C, C]]
  if (sunsetAzDeg !== null) avoid.push(project(sunsetAzDeg, 6))
  if (moon && moon.elDeg > 0) avoid.push(project(moon.azDeg, moon.elDeg))

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
        className="block h-auto w-full"
      >
        <title id={titleId}>
          {`Sky map: the path starts in the ${cardinal(pass.start.azDeg)} at ${formatTime(pass.start.unixMs, timeZone)}, peaks at ${Math.round(pass.peak.elDeg)} degrees, and ends in the ${cardinal(pass.end.azDeg)}.`}
        </title>
        <defs>
          <radialGradient id={`${titleId}-glow`}>
            <stop offset="0" stopColor="var(--station)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--station)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g
          transform={headingDeg != null ? `rotate(${-headingDeg} ${C} ${C})` : undefined}
          style={{ transition: 'transform 0.15s linear' }}
        >
          {/* Horizon and altitude rings */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="var(--night-2)"
            stroke="var(--hair-strong)"
            strokeWidth="1"
          />
          {[30, 60].map((el) => (
            <circle
              key={el}
              cx={C}
              cy={C}
              r={(R * (90 - el)) / 90}
              fill="none"
              stroke="var(--hair)"
              strokeDasharray="2 4"
            />
          ))}
          <text x={C + 4} y={C - (R * 60) / 90 + 12} className="fill-ink-3" fontSize="9">
            30° up
          </text>
          <text x={C + 4} y={C - (R * 30) / 90 + 12} className="fill-ink-3" fontSize="9">
            60°
          </text>
          <circle cx={C} cy={C} r="1.6" className="fill-ink-3" />

          {/* Degree ring: a tick every 10°, numbers every 30° between the cardinals */}
          {Array.from({ length: 36 }, (_, i) => i * 10).map((deg) => {
            const a = (deg * Math.PI) / 180
            const major = deg % 90 === 0
            const r1 = R
            const r2 = R - (major ? 9 : deg % 30 === 0 ? 6 : 3.5)
            return (
              <line
                key={deg}
                x1={C + r1 * Math.sin(a)}
                y1={C - r1 * Math.cos(a)}
                x2={C + r2 * Math.sin(a)}
                y2={C - r2 * Math.cos(a)}
                stroke="var(--hair-strong)"
                strokeWidth={major ? 1.5 : 1}
              />
            )
          })}
          {[30, 60, 120, 150, 210, 240, 300, 330]
            // Leave room for the start/end/sunset labels.
            .filter((deg) =>
              [pass.start.azDeg, pass.end.azDeg, sunsetAzDeg ?? -99].every(
                (az) => Math.abs(((deg - az + 540) % 360) - 180) > 14,
              ),
            )
            .map((deg) => {
              const a = (deg * Math.PI) / 180
              return (
                <text
                  key={deg}
                  x={C + (R - 16) * Math.sin(a)}
                  y={C - (R - 16) * Math.cos(a) + 3}
                  textAnchor="middle"
                  fontSize="8"
                  className="fill-ink-3 tnum"
                >
                  {deg}
                </text>
              )
            })}

          {/* Compass */}
          {(
            [
              ['N', C, C - R - 8],
              ['E', C + R + 10, C + 4],
              ['S', C, C + R + 16],
              ['W', C - R - 10, C + 4],
            ] as const
          ).map(([label, x, y]) => (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-ink-2"
              fontSize="12"
              fontWeight="600"
            >
              {label}
            </text>
          ))}

          {sunsetAzDeg !== null && <SunsetMark azDeg={sunsetAzDeg} />}
          {moon && moon.elDeg > 0 && <MoonMark moon={moon} />}

          {/* The pass: brightness fades where the station dims into shadow */}
          {track.slice(1).map((p, i) => {
            const prev = track[i]
            if (!prev) return null
            const [x1, y1] = project(prev.azDeg, prev.elDeg)
            const [x2, y2] = project(p.azDeg, p.elDeg)
            const opacity = Math.min(1, Math.max(0.15, 1 - (p.magnitude - brightest) / 3))
            return (
              <line
                key={p.unixMs}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--station)"
                strokeOpacity={opacity}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )
          })}
          {mid && midNext && <Chevron from={mid} to={midNext} />}

          {/* Start, peak, end */}
          <circle
            cx={start[0]}
            cy={start[1]}
            r="5"
            fill="var(--night)"
            stroke="var(--station)"
            strokeWidth="2"
          />
          <Label
            at={start}
            dir={dirAt(0)}
            avoid={avoid}
            text={formatTime(pass.start.unixMs, timeZone)}
          />
          <circle cx={peak[0]} cy={peak[1]} r="3" fill="var(--station)" />
          <Label
            at={peak}
            dir={dirAt(peakIndex)}
            avoid={[...avoid, start]}
            text={`${Math.round(pass.peak.elDeg)}° up`}
            subtle
          />
          {pass.end.reason === 'enters-shadow' ? (
            <circle
              cx={end[0]}
              cy={end[1]}
              r="4"
              fill="none"
              stroke="var(--station)"
              strokeOpacity="0.5"
              strokeDasharray="1.5 2"
            />
          ) : (
            <circle cx={end[0]} cy={end[1]} r="2.5" fill="var(--station)" fillOpacity="0.5" />
          )}

          {livePoint && (
            <g transform={`translate(${project(livePoint.azDeg, livePoint.elDeg).join(' ')})`}>
              <circle r="14" fill={`url(#${titleId}-glow)`} />
              <circle r="4" fill="var(--station)" />
            </g>
          )}
        </g>
        {headingDeg != null && (
          <path
            d={`M ${C - 6} ${C - R - 3} L ${C + 6} ${C - R - 3} L ${C} ${C - R + 9} Z`}
            fill="var(--ink)"
            aria-hidden="true"
          />
        )}
      </svg>
      {children}
      <figcaption className="mt-2 flex items-center justify-between gap-4 text-sm text-ink-3">
        <span>Edge of the circle is the horizon; the centre is straight up.</span>
        {!prefersReducedMotion() && (
          <button
            type="button"
            onClick={replay}
            className="shrink-0 rounded-sm text-ink-2 underline decoration-hair-strong underline-offset-4 hover:text-ink"
          >
            Replay
          </button>
        )}
      </figcaption>
    </figure>
  )
}

function interpolate(pass: VisiblePass, t: number) {
  const pts = pass.track
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (a && b && t <= b.unixMs) {
      const f = (t - a.unixMs) / Math.max(1, b.unixMs - a.unixMs)
      let dAz = b.azDeg - a.azDeg
      if (dAz > 180) dAz -= 360
      if (dAz < -180) dAz += 360
      return { azDeg: a.azDeg + f * dAz, elDeg: a.elDeg + f * (b.elDeg - a.elDeg) }
    }
  }
  return pts.at(-1) ?? null
}

function cardinal(az: number) {
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][
    Math.round(az / 45) % 8
  ]
}

/**
 * Place a label beside a point on the track: perpendicular to the path, on the
 * side that stays inside the circle and furthest from anything else drawn.
 */
function Label({
  at,
  dir,
  avoid,
  text,
  subtle,
}: {
  at: [number, number]
  dir: [number, number]
  avoid: ReadonlyArray<[number, number]>
  text: string
  subtle?: boolean
}) {
  const len = Math.hypot(dir[0], dir[1]) || 1
  const n: [number, number] = [-dir[1] / len, dir[0] / len]
  const candidates: Array<[number, number]> = [
    [at[0] + n[0] * 17, at[1] + n[1] * 17],
    [at[0] - n[0] * 17, at[1] - n[1] * 17],
  ]
  const score = ([x, y]: [number, number]) => {
    const inside = Math.hypot(x - C, y - C) < R - 10 ? 0 : -1000
    const clearance = Math.min(...avoid.map(([ax, ay]) => Math.hypot(x - ax, y - ay)), 999)
    return inside + clearance
  }
  const [first, second] = candidates as [[number, number], [number, number]]
  const [x, y] = score(first) >= score(second) ? first : second
  return (
    <text
      x={x}
      y={y + 4}
      textAnchor="middle"
      fontSize="11"
      className={subtle ? 'fill-ink-2' : 'fill-ink tnum'}
      fontWeight={subtle ? 400 : 600}
    >
      {text}
    </text>
  )
}

function Chevron({
  from,
  to,
}: {
  from: { azDeg: number; elDeg: number }
  to: { azDeg: number; elDeg: number }
}) {
  const [x1, y1] = project(from.azDeg, from.elDeg)
  const [x2, y2] = project(to.azDeg, to.elDeg)
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return (
    <path
      d="M -4 -4 L 2 0 L -4 4"
      transform={`translate(${x2} ${y2}) rotate(${angle})`}
      fill="none"
      stroke="var(--station)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function SunsetMark({ azDeg }: { azDeg: number }) {
  const [x, y] = project(azDeg, 0)
  const [lx, ly] = project(azDeg, 12)
  return (
    <g>
      <path
        d={`M ${x - 7} ${y} A 7 7 0 0 1 ${x + 7} ${y}`}
        transform={`rotate(${azDeg} ${x} ${y})`}
        fill="var(--ink-3)"
        fillOpacity="0.6"
      />
      <text x={lx} y={ly + 3} textAnchor="middle" fontSize="9.5" className="fill-ink-3">
        sunset
      </text>
    </g>
  )
}

function MoonMark({ moon }: { moon: MoonInfo }) {
  const [x, y] = project(moon.azDeg, moon.elDeg)
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="6"
        fill="var(--ink-2)"
        fillOpacity={0.15 + 0.6 * moon.illumination}
      />
      <text x={x} y={y + 18} textAnchor="middle" fontSize="9.5" className="fill-ink-3">
        Moon
      </text>
    </g>
  )
}
