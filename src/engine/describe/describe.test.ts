// @vitest-environment node
import {
  brightnessDots,
  brightnessWord,
  compass16,
  compass8,
  fists,
  heightWord,
  motion,
  sunsetCue,
} from './describe.ts'

describe('plain-language helpers', () => {
  it('names compass points', () => {
    expect(compass16(0)).toBe('N')
    expect(compass16(245)).toBe('WSW')
    expect(compass16(349)).toBe('N')
    expect(compass8(305)).toBe('NW')
  })
  it('measures height in fists (≈10° each, half-fist steps)', () => {
    expect(fists(10)).toBe(1)
    expect(fists(34)).toBe(3.5)
    expect(fists(2)).toBe(0.5)
  })
  it('describes height', () => {
    expect(heightWord(80)).toBe('almost-overhead')
    expect(heightWord(34)).toBe('partway-up')
  })
  it('anchors brightness to familiar objects', () => {
    expect(brightnessWord(-3.7)).toBe('dazzling')
    expect(brightnessWord(-2.2)).toBe('very-bright')
    expect(brightnessWord(2.9)).toBe('faint')
    expect(brightnessDots(-3.7)).toBe(5)
    expect(brightnessDots(3)).toBe(0)
  })
  it('relates a direction to where the sun set', () => {
    expect(sunsetCue(245, 252)).toEqual({ kind: 'at-sunset' })
    expect(sunsetCue(230, 252)).toEqual({ kind: 'left-of-sunset', fists: 2 })
    expect(sunsetCue(290, 252)).toEqual({ kind: 'right-of-sunset', fists: 4 })
    expect(sunsetCue(80, 252)).toEqual({ kind: 'opposite-sunset' })
    expect(sunsetCue(10, null)).toEqual({ kind: 'none' })
  })
  it('says which way it moves', () => {
    expect(motion(270, 30, 40)).toBe('left-to-right')
    expect(motion(30, 270, 40)).toBe('right-to-left')
    expect(motion(245, 79, 80)).toBe('overhead')
  })
})
