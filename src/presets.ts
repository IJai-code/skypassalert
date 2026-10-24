// Preset places. Fremont is the launch default, nothing more: every code path
// works for any Place. Coordinates: GeoNames (CC BY 4.0), geonameId 5350734.
import type { Place } from './engine/place.ts'

export const FREMONT: Place = {
  id: 'fremont-ca-us',
  name: 'Fremont, CA',
  latDeg: 37.54827,
  lonDeg: -121.98857,
  elevationM: 17,
  timeZone: 'America/Los_Angeles',
}

export const DEFAULT_PLACE = FREMONT
