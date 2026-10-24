// @vitest-environment node
import {
  ecefToGeodetic,
  geodeticToEcef,
  lookAngles,
  refractionDeg,
  temeToEcef,
  ecefToTeme,
} from './frames.ts'

describe('geodetic ↔ ECEF (WGS-84)', () => {
  it('puts the equator/prime meridian on the x axis at 6378.137 km', () => {
    const [x, y, z] = geodeticToEcef(0, 0, 0)
    expect(x).toBeCloseTo(6378.137, 9)
    expect(y).toBeCloseTo(0, 9)
    expect(z).toBeCloseTo(0, 9)
  })
  it('puts the north pole at the polar radius 6356.752 km', () => {
    expect(geodeticToEcef(90, 0, 0)[2]).toBeCloseTo(6356.752314, 5)
  })
  it.each([
    [37.5485, -121.9886, 0.01],
    [-33.87, 151.21, 0.05],
    [64.15, -21.94, 0.1],
    [-89.9, 45, 2.8],
  ])('round-trips (%f, %f, %f km) to < 1 mm', (lat, lon, h) => {
    const g = ecefToGeodetic(geodeticToEcef(lat, lon, h))
    expect(g.latDeg).toBeCloseTo(lat, 9)
    expect(g.lonDeg).toBeCloseTo(lon, 9)
    expect(Math.abs(g.heightKm - h)).toBeLessThan(1e-6)
  })
})

describe('look angles', () => {
  const obs = geodeticToEcef(0, 0, 0)
  it('straight up is 90° elevation', () => {
    expect(lookAngles(obs, 0, 0, [7000, 0, 0]).elDeg).toBeCloseTo(90, 9)
  })
  it('due north is azimuth 0°, due east 90°', () => {
    expect(lookAngles(obs, 0, 0, [6378.137, 0, 500]).azDeg).toBeCloseTo(0, 6)
    expect(lookAngles(obs, 0, 0, [6378.137, 500, 0]).azDeg).toBeCloseTo(90, 6)
  })
  it('TEME↔ECEF rotation inverts exactly', () => {
    const r = [1234.5, -6789.1, 2345.6] as const
    const back = ecefToTeme(temeToEcef(r, 1.234), 1.234)
    back.forEach((v, i) => expect(v).toBeCloseTo(r[i] as number, 9))
  })
})

it('refraction is ~0.57° at the horizon and tiny overhead', () => {
  expect(refractionDeg(0)).toBeGreaterThan(0.45)
  expect(refractionDeg(0)).toBeLessThan(0.6)
  expect(refractionDeg(45)).toBeLessThan(0.02)
})
