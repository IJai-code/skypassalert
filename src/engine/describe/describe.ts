// Turning angles and magnitudes into words a family can act on.
// Pure functions returning *keys and numbers*, not sentences, so the i18n
// layer (Phase 3) can phrase them naturally in each language.
// Learn: docs/learn/06-brightness.md#words, docs/learn/02-frames.md#directions
import { angleDiffDeg, wrap360 } from '../math/vec.ts'

export const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const
export type Compass16 = (typeof COMPASS_16)[number]

export const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Compass8 = (typeof COMPASS_8)[number]

/** 16-point compass label; each covers 22.5°, centred on its direction. */
export function compass16(azDeg: number): Compass16 {
  return COMPASS_16[Math.round(wrap360(azDeg) / 22.5) % 16] as Compass16
}

/** 8-point compass label for plain speech ("look NW"). */
export function compass8(azDeg: number): Compass8 {
  return COMPASS_8[Math.round(wrap360(azDeg) / 45) % 8] as Compass8
}

/**
 * Elevation in fists at arm's length (≈ 10° each), rounded to the nearest
 * half fist. Nine fists stacked from the horizon reach straight up.
 */
export function fists(elDeg: number): number {
  return Math.max(0.5, Math.round(elDeg / 5) / 2)
}

export type HeightWord = 'low' | 'partway-up' | 'high' | 'almost-overhead' | 'overhead'

export function heightWord(elDeg: number): HeightWord {
  if (elDeg >= 85) return 'overhead'
  if (elDeg >= 70) return 'almost-overhead'
  if (elDeg >= 45) return 'high'
  if (elDeg >= 25) return 'partway-up'
  return 'low'
}

export type BrightnessWord = 'dazzling' | 'very-bright' | 'bright' | 'easy' | 'faint'

/**
 * Anchored to things people know: Venus is about −4, Sirius (brightest
 * star) −1.5, typical bright stars 0 to +1, and +3 is hard in city skies.
 */
export function brightnessWord(magnitude: number): BrightnessWord {
  if (magnitude <= -3) return 'dazzling'
  if (magnitude <= -1.5) return 'very-bright'
  if (magnitude <= 0) return 'bright'
  if (magnitude <= 1.5) return 'easy'
  return 'faint'
}

/** Brightness on a 0–5 scale for the meter in the UI. */
export function brightnessDots(magnitude: number): number {
  return Math.max(0, Math.min(5, Math.round((2.5 - magnitude) / 1.2)))
}

export type SunsetCue =
  | { kind: 'at-sunset' }
  | { kind: 'left-of-sunset' | 'right-of-sunset'; fists: number }
  | { kind: 'opposite-sunset' }
  | { kind: 'none' }

/**
 * Where a direction is relative to where the Sun went down, as a person
 * facing the sunset would describe it. Only useful within ~70° of sunset;
 * beyond that we fall back to compass words.
 */
export function sunsetCue(azDeg: number, sunsetAzDeg: number | null): SunsetCue {
  if (sunsetAzDeg === null) return { kind: 'none' }
  const d = angleDiffDeg(azDeg, sunsetAzDeg) // + is clockwise = to the right when facing it
  const abs = Math.abs(d)
  if (abs <= 8) return { kind: 'at-sunset' }
  if (abs >= 150) return { kind: 'opposite-sunset' }
  if (abs > 70) return { kind: 'none' }
  return { kind: d > 0 ? 'right-of-sunset' : 'left-of-sunset', fists: Math.round(abs / 10) }
}

export type MotionWord = 'left-to-right' | 'right-to-left' | 'overhead'

/** Direction of travel as seen while facing the starting point. */
export function motion(startAzDeg: number, endAzDeg: number, peakElDeg: number): MotionWord {
  if (peakElDeg >= 80) return 'overhead'
  return angleDiffDeg(endAzDeg, startAzDeg) > 0 ? 'left-to-right' : 'right-to-left'
}

/** Whole minutes, at least 1, for "about 4 minutes". */
export function durationMinutes(startMs: number, endMs: number): number {
  return Math.max(1, Math.round((endMs - startMs) / 60_000))
}
