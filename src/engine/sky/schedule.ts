// Which pass is "tonight's best"? Family-first ranking and time-of-day labels.
// Learn: docs/learn/05-passes.md#ranking
import type { VisiblePass } from '../passes/finder.ts'
import { localParts } from '../time/zone.ts'

export type PassPeriod = 'evening' | 'late-night' | 'before-dawn'

/**
 * Evening = noon to 22:00 local; late night = 22:00 to 04:00; before dawn =
 * 04:00 to noon. A 5 AM pass is never "tonight" for a family. (One tracker
 * we tested showed "YES — VISIBLE TONIGHT" for a 5:17 AM pass.)
 */
export function passPeriod(pass: VisiblePass, timeZone: string): PassPeriod {
  const { hour } = localParts(pass.start.unixMs, timeZone)
  if (hour >= 12 && hour < 22) return 'evening'
  if (hour >= 22 || hour < 4) return 'late-night'
  return 'before-dawn'
}

/**
 * Score in [0, 1]: how worth stepping outside for. Height matters most
 * (high passes are long, bright and above rooftops), then brightness, then
 * duration. Weights are judgment calls, documented in DECISIONS.md.
 */
export function passScore(pass: VisiblePass): number {
  const height = Math.min(pass.peak.elDeg, 90) / 90
  const brightness = Math.min(1, Math.max(0, (2 - pass.brightestMagnitude) / 5))
  const minutes = (pass.end.unixMs - pass.start.unixMs) / 60_000
  const duration = Math.min(1, minutes / 5)
  return 0.45 * height + 0.35 * brightness + 0.2 * duration
}

export type BestPassOptions = {
  timeZone: string
  /** Only passes that *end* before this local "HH:MM" (family bedtime filter). */
  bedtime?: string
  periods?: readonly PassPeriod[]
  /** Ignore passes scoring below this. */
  minScore?: number
}

/** The highest-scoring pass among candidates that fit the filters, or null. */
export function bestPass(
  passes: readonly VisiblePass[],
  opts: BestPassOptions,
): VisiblePass | null {
  const periods = opts.periods ?? ['evening']
  let best: VisiblePass | null = null
  let bestScore = -1
  for (const p of passes) {
    if (!periods.includes(passPeriod(p, opts.timeZone))) continue
    if (opts.bedtime && !endsBefore(p, opts.bedtime, opts.timeZone)) continue
    const s = passScore(p)
    if (s < (opts.minScore ?? 0.15)) continue
    if (s > bestScore) {
      best = p
      bestScore = s
    }
  }
  return best
}

function endsBefore(pass: VisiblePass, hhmm: string, timeZone: string): boolean {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const { hour, minute } = localParts(pass.end.unixMs, timeZone)
  // Evening passes only: a 01:00 end is "after" a 21:30 bedtime.
  const endMinutes = hour < 12 ? hour * 60 + minute + 24 * 60 : hour * 60 + minute
  return endMinutes <= h * 60 + m
}
