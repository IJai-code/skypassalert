// The major annual meteor showers, from the International Meteor
// Organization's working list of visual showers (IMO Meteor Shower Calendar,
// Table 5). Peaks are given as the Sun's ecliptic longitude, which repeats
// every year to within a few hours, so the table needs no yearly update.
// Facts only; source recorded in ASSETS.md.
// Learn: docs/learn/15-meteors.md

export type ShowerId =
  'QUA' | 'LYR' | 'ETA' | 'SDA' | 'PER' | 'DRA' | 'ORI' | 'STA' | 'NTA' | 'LEO' | 'GEM' | 'URS'

export type Shower = {
  id: ShowerId
  name: string
  /** Active window as [month, day], inclusive; may wrap the new year. */
  from: readonly [number, number]
  to: readonly [number, number]
  /** Solar longitude of the peak, degrees (J2000). */
  peakSolarLonDeg: number
  /** Zenithal hourly rate at the peak: under a perfect sky, radiant overhead. */
  zhr: number
  /** Radiant at the peak, degrees (J2000). */
  raDeg: number
  decDeg: number
  /** Entry speed, km/s: fast showers leave more glowing trains. */
  speedKms: number
  /**
   * How fast the rate falls away from the peak: ZHR × 10^(−slope·|Δλ|), Δλ in
   * degrees (≈ days). A rough single-slope profile; real showers are lopsided.
   */
  slope: number
}

export const SHOWERS: readonly Shower[] = [
  {
    id: 'QUA',
    name: 'Quadrantids',
    from: [12, 28],
    to: [1, 12],
    peakSolarLonDeg: 283.15,
    zhr: 80,
    raDeg: 230,
    decDeg: 49,
    speedKms: 41,
    slope: 1.8,
  },
  {
    id: 'LYR',
    name: 'Lyrids',
    from: [4, 14],
    to: [4, 30],
    peakSolarLonDeg: 32.32,
    zhr: 18,
    raDeg: 271,
    decDeg: 34,
    speedKms: 49,
    slope: 0.25,
  },
  {
    id: 'ETA',
    name: 'Eta Aquariids',
    from: [4, 19],
    to: [5, 28],
    peakSolarLonDeg: 45.5,
    zhr: 50,
    raDeg: 338,
    decDeg: -1,
    speedKms: 66,
    slope: 0.08,
  },
  {
    id: 'SDA',
    name: 'Southern Delta Aquariids',
    from: [7, 12],
    to: [8, 23],
    peakSolarLonDeg: 127,
    zhr: 25,
    raDeg: 340,
    decDeg: -16,
    speedKms: 41,
    slope: 0.08,
  },
  {
    id: 'PER',
    name: 'Perseids',
    from: [7, 17],
    to: [8, 24],
    peakSolarLonDeg: 140.0,
    zhr: 100,
    raDeg: 48,
    decDeg: 58,
    speedKms: 59,
    slope: 0.2,
  },
  {
    id: 'DRA',
    name: 'Draconids',
    from: [10, 6],
    to: [10, 10],
    peakSolarLonDeg: 195.4,
    zhr: 10,
    raDeg: 262,
    decDeg: 54,
    speedKms: 20,
    slope: 1.5,
  },
  {
    id: 'ORI',
    name: 'Orionids',
    from: [10, 2],
    to: [11, 7],
    peakSolarLonDeg: 208,
    zhr: 20,
    raDeg: 95,
    decDeg: 16,
    speedKms: 66,
    slope: 0.12,
  },
  {
    id: 'STA',
    name: 'Southern Taurids',
    from: [9, 10],
    to: [11, 20],
    peakSolarLonDeg: 223,
    zhr: 5,
    raDeg: 52,
    decDeg: 15,
    speedKms: 27,
    slope: 0.02,
  },
  {
    id: 'NTA',
    name: 'Northern Taurids',
    from: [10, 20],
    to: [12, 10],
    peakSolarLonDeg: 230,
    zhr: 5,
    raDeg: 58,
    decDeg: 22,
    speedKms: 29,
    slope: 0.02,
  },
  {
    id: 'LEO',
    name: 'Leonids',
    from: [11, 6],
    to: [11, 30],
    peakSolarLonDeg: 235.27,
    zhr: 15,
    raDeg: 152,
    decDeg: 22,
    speedKms: 71,
    slope: 0.25,
  },
  {
    id: 'GEM',
    name: 'Geminids',
    from: [12, 4],
    to: [12, 20],
    peakSolarLonDeg: 262.2,
    zhr: 150,
    raDeg: 112,
    decDeg: 33,
    speedKms: 35,
    slope: 0.35,
  },
  {
    id: 'URS',
    name: 'Ursids',
    from: [12, 17],
    to: [12, 26],
    peakSolarLonDeg: 270.7,
    zhr: 10,
    raDeg: 217,
    decDeg: 76,
    speedKms: 33,
    slope: 0.6,
  },
]
