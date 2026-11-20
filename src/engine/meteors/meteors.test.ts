// @vitest-environment node
import { isActive, moonFactor, showersTonight, solarLongitudeDeg } from './meteors.ts'
import { SHOWERS } from './showers.ts'
import { eveningFor } from '../sky/sunEvents.ts'
import { FREMONT } from '../../presets.ts'
import type { Place } from '../place.ts'

const SYDNEY: Place = {
  id: 'sydney',
  name: 'Sydney, AU',
  latDeg: -33.87,
  lonDeg: 151.21,
  elevationM: 20,
  timeZone: 'Australia/Sydney',
}
const tonight = (p: Place, key: string) => showersTonight(p, eveningFor(p, key))
const shower = (id: string) => SHOWERS.find((s) => s.id === id)!

describe('meteor showers', () => {
  it('follows the Sun: the Perseids peak (λ☉ 140.0°) falls on 12–13 August 2026', () => {
    const lambda = solarLongitudeDeg(Date.parse('2026-08-12T20:00:00Z'))
    expect(Math.abs(lambda - 140.0)).toBeLessThan(0.5)
    const per = tonight(FREMONT, '2026-08-12').find((s) => s.id === 'PER')
    expect(per).toBeDefined()
    expect(Math.abs(per!.peakInDays)).toBeLessThanOrEqual(1)
    // A big shower with no Moon: dozens an hour from a dark spot.
    expect(per!.rateHigh).toBeGreaterThan(40)
    expect(per!.rateLow).toBeLessThan(per!.rateHigh)
  })

  it('lists the Leonids in the week before their 17 November peak', () => {
    const leo = tonight(FREMONT, '2026-11-15').find((s) => s.id === 'LEO')
    expect(leo).toBeDefined()
    expect(leo!.peakInDays).toBeGreaterThan(0)
    expect(leo!.peakInDays).toBeLessThanOrEqual(2)
    // Their radiant rises around midnight: best before dawn, in the east-to-south sky.
    expect(leo!.radiantElDeg).toBeGreaterThan(40)
  })

  it('handles windows that wrap the new year', () => {
    const qua = shower('QUA')
    expect(isActive(qua, 1, 3)).toBe(true)
    expect(isActive(qua, 12, 30)).toBe(true)
    expect(isActive(qua, 6, 1)).toBe(false)
  })

  it('leaves out showers whose radiant never climbs: no Quadrantids in Sydney', () => {
    expect(tonight(SYDNEY, '2027-01-03').some((s) => s.id === 'QUA')).toBe(false)
    // …while the southern Eta Aquariids show up there in May.
    expect(tonight(SYDNEY, '2026-05-05').some((s) => s.id === 'ETA')).toBe(true)
  })

  it('a bright Moon in the sky cuts the rate; a Moon below the horizon does not', () => {
    expect(moonFactor(1, true)).toBeCloseTo(0.35)
    expect(moonFactor(1, false)).toBe(1)
    expect(moonFactor(0.1, true)).toBeGreaterThan(0.9)
  })

  it('says nothing on a night with no active shower', () => {
    expect(tonight(FREMONT, '2026-03-10')).toEqual([])
  })
})
