// @vitest-environment node
import { readFileSync } from 'node:fs'
import {
  cityLabel,
  nearestCity,
  placeFromCity,
  placeFromPosition,
  searchCities,
  type CityDb,
} from './places.ts'

const db = JSON.parse(
  readFileSync(new URL('../../public/data/cities.json', import.meta.url), 'utf8'),
) as CityDb

describe('place search', () => {
  it('finds Fremont, CA first for "fremont" (the biggest Fremont)', () => {
    expect(cityLabel(searchCities(db, 'fremont')[0]!)).toBe('Fremont, CA')
  })
  it('narrows with a region: "fremont oh"', () => {
    expect(cityLabel(searchCities(db, 'fremont, oh')[0]!)).toBe('Fremont, OH')
  })
  it('ignores accents: "sao paulo"', () => {
    expect(searchCities(db, 'sao paulo')[0]![1]).toBe('São Paulo')
  })
  it('builds a Place with the right IANA zone', () => {
    const p = placeFromCity(db, searchCities(db, 'tokyo')[0]!)
    expect(p.timeZone).toBe('Asia/Tokyo')
  })
  it('names a GPS fix after the nearest city and rounds it (~100 m) for privacy', () => {
    const p = placeFromPosition(db, 37.551234, -121.98111, null)
    expect(p.name).toBe('Near Fremont, CA')
    expect(p.latDeg).toBe(37.551)
    expect(p.timeZone).toBe('America/Los_Angeles')
    expect(nearestCity(db, -33.86, 151.21)![1]).toBe('Sydney')
  })
})
