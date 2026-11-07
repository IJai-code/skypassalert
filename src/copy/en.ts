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
const BRIGHTNESS_SIMPLE: Record<BrightnessWord, string> = {
  dazzling: 'Super bright: brighter than every star.',
  'very-bright': 'Brighter than any star.',
  bright: 'As bright as the brightest stars.',
  easy: 'Easy to see if it’s dark around you.',
  faint: 'Hard to see. Find a dark spot.',
}
/** `simple`: the family "simple words" register (same facts, shorter words). */
export const brightnessSentence = (mag: number, simple = false) =>
  (simple ? BRIGHTNESS_SIMPLE : BRIGHTNESS)[brightnessWord(mag)]

export const fistsLabel = (elDeg: number) => {
  const n = fists(elDeg)
  return `${n} fist${n === 1 ? '' : 's'}`
}

/** "Rises low in the west-southwest and climbs almost straight overhead." */
export function pathSentence(p: VisiblePass, simple = false): string {
  if (simple) return pathSentenceSimple(p)
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

/** "It comes up low in the west, goes almost right over your head, then disappears." */
function pathSentenceSimple(p: VisiblePass): string {
  const startDir = direction(p.start.azDeg)
  const start =
    p.start.reason === 'leaves-shadow'
      ? `It pops out of nowhere ${fistsLabel(p.start.elDeg)} up in the ${startDir}`
      : p.start.reason === 'sky-darkens' || p.start.reason === 'window-start'
        ? `It’s already up in the ${startDir}`
        : `It comes up low in the ${startDir}`
  const peakDir = direction(p.peak.azDeg)
  const climb = {
    overhead: 'goes right over your head',
    'almost-overhead': 'goes almost right over your head',
    high: `goes up high in the ${peakDir}`,
    'partway-up': `goes halfway up the ${peakDir} sky`,
    low: `stays low in the ${peakDir}`,
  }[heightWord(p.peak.elDeg)]
  if (p.end.reason === 'enters-shadow') {
    return `${start}, ${climb}, then disappears into Earth’s shadow.`
  }
  return `${start}, ${climb} and goes down in the ${direction(p.end.azDeg)}.`
}

/** How to find the starting point, anchored to sunset when that helps. */
export function startCue(
  p: VisiblePass,
  sunsetAzDeg: number | null,
  isEvening: boolean,
  simple = false,
): string {
  const cue = isEvening ? sunsetCue(p.start.azDeg, sunsetAzDeg) : ({ kind: 'none' } as const)
  const dir = direction(p.start.azDeg)
  if (simple) {
    switch (cue.kind) {
      case 'at-sunset':
        return 'Look where the sun went down.'
      case 'left-of-sunset':
      case 'right-of-sunset': {
        const n = Math.max(1, cue.fists)
        const side = cue.kind === 'left-of-sunset' ? 'left' : 'right'
        return `Look where the sun went down, then ${n === 1 ? 'one fist' : `${n} fists`} to the ${side}.`
      }
      case 'opposite-sunset':
        return 'Turn your back to where the sun went down.'
      default:
        return `Look ${dir}.`
    }
  }
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

export function endNote(p: VisiblePass, simple = false): string | null {
  if (p.end.reason !== 'enters-shadow') return null
  if (simple)
    return 'It doesn’t set. It fades away like a light turning off: that’s Earth’s shadow.'
  return `It won’t set: it fades out ${fistsLabel(p.end.elDeg)} up as it slips into Earth’s shadow. That’s normal.`
}

export const minutesLabel = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000))
  return `${m} min`
}

// ── The Night (Tonight tab): one line per kind of stop ───────────────────

export const PLANET_NAMES: Record<string, string> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
}

/** "Waxing crescent", "Full Moon"… from the lit fraction. */
export function moonPhaseName(illumination: number, waxing: boolean): string {
  if (illumination < 0.04) return 'New Moon'
  if (illumination > 0.96) return 'Full Moon'
  const side = waxing ? 'Waxing' : 'Waning'
  if (illumination < 0.45) return `${side} crescent`
  if (illumination < 0.55) return waxing ? 'First quarter' : 'Last quarter'
  return `${side} gibbous`
}

/** Where something is, in words: "southeast, 3 fists up". */
export const whereInSky = (azDeg: number, elDeg: number) =>
  `${direction(azDeg)}, ${fistsLabel(elDeg)} up`

export function planetLine(magnitude: number): string {
  if (magnitude < -3) return 'Brighter than anything but the Moon.'
  if (magnitude < -1.5) return 'Brighter than any star.'
  if (magnitude < 0.5) return 'As bright as the brightest stars, and it doesn’t twinkle.'
  return 'An easy, steady point of light.'
}

export const NIGHT_COPY = {
  sunset: (dir: string) =>
    `The sun goes down in the ${dir}. Stations are easiest in the next two hours: still in sunlight high up, while your sky turns dark.`,
  dark: 'Civil twilight ends: dark enough for the brightest stars and planets. Give your eyes a few minutes away from bright screens.',
  sunrise: 'The night ends here.',
  dawnPass: 'Before dawn, for early risers.',
  weakPass: 'Low or faint: listed so you know, not worth a special trip.',
}

// ── Meteor showers (docs/learn/15-meteors.md) ────────────────────────────

/** "peak tonight", "2 days to peak", "1 day after peak". */
export function meteorPeakLabel(peakInDays: number): string {
  if (peakInDays === 0) return 'peak tonight'
  if (peakInDays === 1) return 'peak tomorrow'
  const n = Math.abs(peakInDays)
  const days = `${n} day${n === 1 ? '' : 's'}`
  return peakInDays > 0 ? `${days} to peak` : `${days} after peak`
}

export const meteorRate = (low: number, high: number) => `${low}–${high}/h`

export function meteorSentence(s: {
  rateLow: number
  rateHigh: number
  radiantAzDeg: number
  radiantElDeg: number
  moonIllumination: number
  moonUp: boolean
}): string {
  const where = whereInSky(s.radiantAzDeg, s.radiantElDeg)
  const moon =
    s.moonUp && s.moonIllumination > 0.5 ? ' The bright Moon will hide the fainter ones.' : ''
  return `Maybe ${s.rateLow} to ${s.rateHigh} an hour from a dark spot, far fewer under town lights. They streak out from the ${where}: look anywhere around there, not straight at it, and give your eyes 20 minutes to adjust.${moon}`
}

export const METEOR_NOTE =
  'Meteor rates are rough: showers change from year to year and come in bursts. Lie back and be patient.'

export const AFTER_BEDTIME = 'after bedtime'
