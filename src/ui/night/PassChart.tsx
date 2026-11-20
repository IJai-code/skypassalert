// A pass drawn like a star-atlas plate: the whole sky as a circle (edge =
// horizon, centre = straight up, north up, east right), altitude rings at 30°
// and 60°, and the station's real path with its minute marks. A path that
// ends in Earth's shadow trails off dashed instead of reaching the horizon.
// Docs: docs/DESIGN.md#almanac
import type { ForecastPass } from '../../engine/index.ts'
import { direction } from '../../copy/en.ts'

type Props = {
  pass: ForecastPass
  /** Where the sun went down, for the "sun" tick on the horizon. */
  sunsetAzDeg?: number | null
  size?: number
  /** Minute labels and cardinal letters; off for the small Week glyphs. */
  labels?: boolean
  formatMinute: (ms: number) => string
  /** Spoken description; empty hides the chart from screen readers. */
  label: string
}

const DEG = Math.PI / 180

export type ChartPoint = { x: number; y: number }

/** Polar plot: radius grows linearly from the zenith to the horizon. */
export function chartXY(azDeg: number, elDeg: number, r: number): ChartPoint {
  // Slightly below the horizon is allowed: labels sit just outside the ring.
  const rr = (r * (90 - Math.max(-20, elDeg))) / 90
  return { x: rr * Math.sin(azDeg * DEG), y: -rr * Math.cos(azDeg * DEG) }
}

/** Whole-minute marks along the visible path, interpolated from the track. */
export function minuteMarks(
  pass: ForecastPass,
): Array<{ unixMs: number; azDeg: number; elDeg: number }> {
  const out: Array<{ unixMs: number; azDeg: number; elDeg: number }> = []
  const tr = pass.track
  const first = Math.ceil(pass.start.unixMs / 60_000) * 60_000
  let i = 0
  for (let t = first; t <= pass.end.unixMs; t += 60_000) {
    while (i < tr.length - 2 && (tr[i + 1]?.unixMs ?? Infinity) < t) i++
    const a = tr[i]
    const b = tr[i + 1]
    if (!a || !b) break
    const f = Math.max(0, Math.min(1, (t - a.unixMs) / (b.unixMs - a.unixMs || 1)))
    // Azimuth wraps at north: interpolate the short way round.
    const dAz = ((b.azDeg - a.azDeg + 540) % 360) - 180
    out.push({
      unixMs: t,
      azDeg: (a.azDeg + dAz * f + 360) % 360,
      elDeg: a.elDeg + (b.elDeg - a.elDeg) * f,
    })
  }
  return out
}

export function PassChart({
  pass,
  sunsetAzDeg = null,
  size = 150,
  labels = true,
  formatMinute,
  label,
}: Props) {
  const pad = labels ? 14 : 2
  const r = size / 2 - pad
  const c = size / 2
  const at = (az: number, el: number) => {
    const p = chartXY(az, el, r)
    return { x: c + p.x, y: c + p.y }
  }
  const path = pass.track
    .map((p, k) => {
      const q = at(p.azDeg, p.elDeg)
      return `${k ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`
    })
    .join(' ')
  const end = at(pass.end.azDeg, pass.end.elDeg)
  const start = at(pass.start.azDeg, pass.start.elDeg)
  const peak = at(pass.peak.azDeg, pass.peak.elDeg)

  // Into the shadow: continue the last segment's heading a little, dashed.
  const tail = (() => {
    if (pass.end.reason !== 'enters-shadow') return null
    const tr = pass.track
    const a = tr[tr.length - 2]
    if (!a) return null
    const p = at(a.azDeg, a.elDeg)
    const dx = end.x - p.x
    const dy = end.y - p.y
    const len = Math.hypot(dx, dy) || 1
    const k = (size * 0.09) / len
    return `M${end.x.toFixed(1)} ${end.y.toFixed(1)} L${(end.x + dx * k).toFixed(1)} ${(end.y + dy * k).toFixed(1)}`
  })()

  // Label the start, the peak and the end; skip any that would collide.
  const tags: Array<{ x: number; y: number; text: string; anchor: 'start' | 'end' }> = []
  if (labels) {
    for (const [pt, ms] of [
      [start, pass.start.unixMs],
      [peak, pass.peak.unixMs],
      [end, pass.end.unixMs],
    ] as const) {
      if (tags.some((t) => Math.hypot(t.x - pt.x, t.y - pt.y) < 30)) continue
      const right = pt.x < c + r * 0.45
      // Labels sit on the side of the point away from the centre of the chart.
      const below = pt.y > c + 4
      tags.push({
        x: pt.x + (right ? 6 : -6),
        y: pt.y + (below ? 13 : -6),
        text: formatMinute(ms),
        anchor: right ? 'start' : 'end',
      })
    }
  }

  const sun = sunsetAzDeg === null ? null : at(sunsetAzDeg, 0)
  // Just outside the horizon ring, clear of the cardinal letters.
  const sunOut = sunsetAzDeg === null ? null : at(sunsetAzDeg, -12)
  const cardinal = (['N', 'E', 'S', 'W'] as const).map((n, k) => ({ n, ...at(k * 90, 0) }))

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className="block shrink-0 overflow-visible"
    >
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ink)" strokeWidth={labels ? 1 : 0.75} />
      {labels && (
        <g fill="none" stroke="var(--rule)" strokeWidth="1">
          <circle cx={c} cy={c} r={(r * 2) / 3} />
          <circle cx={c} cy={c} r={r / 3} />
          <line x1={c} y1={c - r} x2={c} y2={c + r} />
          <line x1={c - r} y1={c} x2={c + r} y2={c} />
        </g>
      )}
      {labels &&
        cardinal.map(({ n, x, y }) => {
          const ix = c + (x - c) * 0.84
          const iy = c + (y - c) * 0.84
          return (
            <g key={n}>
              <line
                x1={x}
                y1={y}
                x2={c + (x - c) * 0.92}
                y2={c + (y - c) * 0.92}
                stroke="var(--ink)"
              />
              <text
                x={ix}
                y={iy}
                dy="0.35em"
                textAnchor="middle"
                className="mono"
                fontSize="9"
                fill="var(--ink-2)"
              >
                {n}
              </text>
            </g>
          )
        })}
      {sun && sunOut && labels && (
        <g>
          <line
            x1={sun.x}
            y1={sun.y}
            x2={sunOut.x}
            y2={sunOut.y}
            stroke="var(--ink-2)"
            strokeWidth="1"
          />
          <text
            x={sunOut.x}
            y={sunOut.y}
            dy={sunOut.y > c ? '0.9em' : '-0.3em'}
            textAnchor="middle"
            className="mono"
            fontSize="8"
            fill="var(--ink-2)"
          >
            sun
          </text>
        </g>
      )}
      <path
        d={path}
        fill="none"
        stroke="var(--station)"
        strokeWidth={labels ? 1.6 : 1.4}
        strokeLinecap="round"
      />
      {tail && (
        <path
          d={tail}
          data-part="shadow"
          fill="none"
          stroke="var(--station)"
          strokeWidth="1.2"
          strokeDasharray="2 3"
        />
      )}
      {labels &&
        minuteMarks(pass).map((m) => {
          const q = at(m.azDeg, m.elDeg)
          return <circle key={m.unixMs} cx={q.x} cy={q.y} r="1.6" fill="var(--station)" />
        })}
      <circle cx={start.x} cy={start.y} r={labels ? 2.6 : 1.8} fill="var(--station)" />
      {labels && (
        <circle
          cx={peak.x}
          cy={peak.y}
          r="3"
          fill="none"
          stroke="var(--station)"
          strokeWidth="1.2"
        />
      )}
      {tags.map((t) => (
        <text
          key={t.text + t.x}
          x={t.x}
          y={t.y}
          textAnchor={t.anchor}
          className="mono"
          fontSize="9"
          fill="var(--station)"
        >
          {t.text}
        </text>
      ))}
    </svg>
  )
}

/** "Sky chart: starts in the west-northwest, highest in the north…" */
export function chartLabel(pass: ForecastPass): string {
  const end = pass.end.reason === 'enters-shadow' ? 'fades out' : 'sets'
  return `Sky chart of the path: starts in the ${direction(pass.start.azDeg)}, highest ${Math.round(pass.peak.elDeg)}° up in the ${direction(pass.peak.azDeg)}, ${end} in the ${direction(pass.end.azDeg)}.`
}
