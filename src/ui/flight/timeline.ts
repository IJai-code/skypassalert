// Scroll is the clock. How far you've scrolled through the Flight (p, 0 → 1)
// decides which beat you're in, what time it is in the film, and how far the
// camera has risen. Pure numbers, no DOM: easy to test, same on every device.
// Learn: docs/learn/16-the-flight.md#timeline
import { clamp01, smooth, smoothstep } from './vec.ts'

export type Beat = 'tonight' | 'pass' | 'lift' | 'settle' | 'dusk'

type Span = { beat: Beat; from: number; to: number }

export type Timeline = {
  kind: 'pass' | 'dusk'
  spans: Span[]
  /** Film clock at the top of the page, and at the end of the moving part. */
  clock0: number
  clock1: number
  /** Scroll height of the section, in screen heights (the stage is one of them). */
  screens: number
}

/**
 * A pass night: stand in your yard (tonight), scrub the pass (pass), rise to
 * orbit (lift), then hand back to the page (settle).
 * The film opens at the pass's start, or at "now" if it's already up.
 */
export function passTimeline(startMs: number, endMs: number, nowMs: number): Timeline {
  return {
    kind: 'pass',
    spans: [
      { beat: 'tonight', from: 0, to: 0.08 },
      { beat: 'pass', from: 0.08, to: 0.52 },
      { beat: 'lift', from: 0.52, to: 0.84 },
      { beat: 'settle', from: 0.84, to: 1 },
    ],
    clock0: Math.max(startMs, Math.min(nowMs, endMs)),
    clock1: endMs,
    screens: 3.2,
  }
}

/** A night with no pass: scrub dusk into dark and watch the stars come out. */
export function duskTimeline(fromMs: number, toMs: number): Timeline {
  return {
    kind: 'dusk',
    spans: [
      { beat: 'tonight', from: 0, to: 0.12 },
      { beat: 'dusk', from: 0.12, to: 0.88 },
      { beat: 'settle', from: 0.88, to: 1 },
    ],
    clock0: fromMs,
    clock1: Math.max(fromMs, toMs),
    screens: 2.2,
  }
}

export type At = {
  beat: Beat
  /** Progress inside the beat, 0 → 1. */
  u: number
  /** Time shown in the film. */
  clockMs: number
  /** 0 = standing on the ground, 1 = in orbit. */
  lift: number
  /** 0 = the answer sits on the ground in big type, 1 = docked as a mono line up top. */
  dock: number
  /**
   * The camera turns to follow the station (normal), or holds one wide frame
   * that shows the whole pass (reduced motion: nothing moves but the station).
   */
  follow: boolean
}

export function at(tl: Timeline, pRaw: number, reducedMotion = false): At {
  const p = clamp01(pRaw)
  const span = tl.spans.find((s) => p <= s.to) ?? tl.spans[tl.spans.length - 1]!
  const u = clamp01((p - span.from) / (span.to - span.from))
  const moving = tl.spans.find((s) => s.beat === 'pass' || s.beat === 'dusk')!
  const mu = clamp01((p - moving.from) / (moving.to - moving.from))
  // Linear on purpose: a centimetre of scroll is the same slice of time all
  // the way through, so the station's speed on screen is its real speed.
  const clockMs = tl.clock0 + (tl.clock1 - tl.clock0) * mu

  let lift = 0
  if (tl.kind === 'pass') {
    const ls = tl.spans.find((s) => s.beat === 'lift')!
    const lu = clamp01((p - ls.from) / (ls.to - ls.from))
    // Reduced motion: no flight, just a cut to orbit halfway through the beat.
    lift = reducedMotion ? (lu >= 0.5 ? 1 : 0) : smooth(lu)
  }

  return {
    beat: span.beat,
    u,
    clockMs,
    lift,
    dock: reducedMotion ? (p > 0.05 ? 1 : 0) : smoothstep(0.015, 0.075, p),
    follow: !reducedMotion,
  }
}

/** Inverse of the clock: the scroll progress that shows a given moment. */
export function progressForClock(tl: Timeline, clockMs: number): number {
  const moving = tl.spans.find((s) => s.beat === 'pass' || s.beat === 'dusk')!
  const span = tl.clock1 - tl.clock0
  const f = span > 0 ? clamp01((clockMs - tl.clock0) / span) : 0
  return moving.from + f * (moving.to - moving.from)
}
