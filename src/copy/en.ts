// English phrasing for the engine's describe() keys. Phase 3 moves this into
// an i18n catalog with zh-Hans next to it; keeping copy out of components now
// makes that a move, not a rewrite.
// Voice: calm, specific, a friend standing next to you. Docs: docs/DESIGN.md#voice
import type { VisiblePass } from '../engine/index.ts'
import {
  brightnessWord,
  compass16,
  fists,
  heightWord,
  sunsetCue,
  type BrightnessWord,
  type Compass16,
} from '../engine/describe/describe.ts'

const COMPASS_WORDS: Record<Compass16, string> = {
  N: 'north',
  NNE: 'north-northeast',
  NE: 'northeast',
  ENE: 'east-northeast',
  E: 'east',
  ESE: 'east-southeast',
  SE: 'southeast',
  SSE: 'south-southeast',
  S: 'south',
  SSW: 'south-southwest',
  SW: 'southwest',
  WSW: 'west-southwest',
  W: 'west',
  WNW: 'west-northwest',
  NW: 'northwest',
  NNW: 'north-northwest',
}

export const direction = (azDeg: number) => COMPASS_WORDS[compass16(azDeg)]

export function stationName(noradId: number): { short: string; long: string } {
  switch (noradId) {
    case 25544:
      return { short: 'ISS', long: 'the International Space Station' }
    case 48274:
      return { short: 'Tiangong', long: 'Tiangong, China’s space station' }
    default:
      return { short: `#${noradId}`, long: `satellite ${noradId}` }
  }
}

const BRIGHTNESS: Record<BrightnessWord, string> = {
  dazzling: 'Dazzling: only the Moon and Venus outshine it.',
  'very-bright': 'Very bright, brighter than any star.',
  bright: 'Bright, like the brightest stars.',
  easy: 'Easy to spot away from streetlights.',
  faint: 'Faint. You’ll want a dark spot.',
}
export const brightnessSentence = (mag: number) => BRIGHTNESS[brightnessWord(mag)]

export const fistsLabel = (elDeg: number) => {
  const n = fists(elDeg)
  return `${n} fist${n === 1 ? '' : 's'}`
}

/** "Rises low in the west-southwest and climbs almost straight overhead." */
export function pathSentence(p: VisiblePass): string {
  const startDir = direction(p.start.azDeg)
  const start =
    p.start.reason === 'leaves-shadow'
      ? `Appears out of Earth’s shadow ${fistsLabel(p.start.elDeg)} up in the ${startDir}`
      : p.start.reason === 'sky-darkens' || p.start.reason === 'window-start'
        ? `Already up in the ${startDir}`
        : `Rises low in the ${startDir}`

  const peakDir = direction(p.peak.azDeg)
  const climb = {
    overhead: 'passes straight overhead',
    'almost-overhead': 'climbs almost straight overhead',
    high: `climbs high in the ${peakDir}`,
    'partway-up': `climbs partway up the ${peakDir} sky`,
    low: `stays low in the ${peakDir}`,
  }[heightWord(p.peak.elDeg)]

  // A pass that enters shadow at its highest point "climbs" and vanishes there.
  const peakIsEnd = p.end.unixMs - p.peak.unixMs < 3_000
  if (p.end.reason === 'enters-shadow') {
    return peakIsEnd
      ? `${start}, ${climb}, then fades out as it enters Earth’s shadow.`
      : `${start}, ${climb}, then fades out in the ${direction(p.end.azDeg)}.`
  }
  return `${start}, ${climb} and sets in the ${direction(p.end.azDeg)}.`
}

/** How to find the starting point, anchored to sunset when that helps. */
export function startCue(p: VisiblePass, sunsetAzDeg: number | null, isEvening: boolean): string {
  const cue = isEvening ? sunsetCue(p.start.azDeg, sunsetAzDeg) : ({ kind: 'none' } as const)
  const dir = direction(p.start.azDeg)
  switch (cue.kind) {
    case 'at-sunset':
      return 'Look where the sun went down. It starts right there.'
    case 'left-of-sunset':
    case 'right-of-sunset': {
      const side = cue.kind === 'left-of-sunset' ? 'left' : 'right'
      const n = Math.max(1, cue.fists)
      return `Face where the sun went down, then look ${n === 1 ? 'one fist' : `${n} fists`} to the ${side}.`
    }
    case 'opposite-sunset':
      return `Stand with your back to where the sun went down. It starts in front of you, in the ${dir}.`
    default:
      return `Face ${dir}.`
  }
}

export function endNote(p: VisiblePass): string | null {
  if (p.end.reason !== 'enters-shadow') return null
  return `It won’t set: it fades out ${fistsLabel(p.end.elDeg)} up as it slips into Earth’s shadow. That’s normal.`
}

export const minutesLabel = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000))
  return `${m} min`
}
