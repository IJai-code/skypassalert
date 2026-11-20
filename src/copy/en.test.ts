// @vitest-environment node
// Both registers (the usual one and "simple words") must have a sentence for
// every kind of pass the engine can describe.
import type { VisiblePass } from '../engine/index.ts'
import {
  brightnessSentence,
  endNote,
  meteorPeakLabel,
  meteorSentence,
  pathSentence,
  startCue,
} from './en.ts'

type StartR = VisiblePass['start']['reason']
type EndR = VisiblePass['end']['reason']
const point = (azDeg: number, elDeg: number, unixMs: number) => ({ azDeg, elDeg, unixMs })

function pass(peakEl: number, start: StartR, end: EndR): VisiblePass {
  return {
    noradId: 25544,
    start: { ...point(250, start === 'rise' ? 10 : 25, 0), reason: start },
    peak: point(330, peakEl, 120_000),
    end: { ...point(60, end === 'sets' ? 10 : 30, 240_000), reason: end },
    brightestMagnitude: -2,
    track: [],
  } as unknown as VisiblePass
}

const STARTS: StartR[] = ['rises', 'leaves-shadow', 'sky-darkens', 'window-start'] as StartR[]
const ENDS: EndR[] = ['sets', 'enters-shadow'] as EndR[]
const PEAKS = [89, 75, 55, 30, 12]

describe('pass wording', () => {
  it.each([false, true])('has a sentence for every pass shape (simple: %s)', (simple) => {
    for (const s of STARTS)
      for (const e of ENDS)
        for (const el of PEAKS) {
          const text = pathSentence(pass(el, s, e), simple)
          expect(text).toMatch(/^[A-Z].+\.$/)
          expect(text).not.toMatch(/undefined|NaN/)
        }
  })

  it('simple words keep the facts but drop the grown-up phrasing', () => {
    const p = pass(80, 'rises' as StartR, 'enters-shadow' as EndR)
    expect(pathSentence(p)).toMatch(/climbs almost straight overhead/)
    expect(pathSentence(p, true)).toBe(
      'It comes up low in the west-southwest, goes almost right over your head, then disappears into Earth’s shadow.',
    )
    expect(startCue(p, 250, true, true)).toBe('Look where the sun went down.')
    expect(endNote(p, true)).toMatch(/Earth’s shadow/)
    for (const mag of [-4, -2.5, -1, 0.5, 2.5])
      expect(brightnessSentence(mag, true)).not.toBe(brightnessSentence(mag))
  })
})

describe('meteor wording', () => {
  it('counts days to and from the peak', () => {
    expect(meteorPeakLabel(0)).toBe('peak tonight')
    expect(meteorPeakLabel(1)).toBe('peak tomorrow')
    expect(meteorPeakLabel(2)).toBe('2 days to peak')
    expect(meteorPeakLabel(-3)).toBe('3 days after peak')
  })
  it('gives a range, where to look, and mentions a bright Moon', () => {
    const s = {
      rateLow: 4,
      rateHigh: 14,
      radiantAzDeg: 100,
      radiantElDeg: 60,
      moonIllumination: 0.9,
      moonUp: true,
    }
    expect(meteorSentence(s)).toMatch(/^Maybe 4 to 14 an hour/)
    expect(meteorSentence(s)).toMatch(/east, 6 fists up/)
    expect(meteorSentence(s)).toMatch(/bright Moon/)
    expect(meteorSentence({ ...s, moonUp: false })).not.toMatch(/Moon/)
  })
})
