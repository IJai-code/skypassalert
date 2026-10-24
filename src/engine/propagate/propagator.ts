// The Propagator interface: the only door between orbital elements and the
// rest of the engine. Phase 2 ships a satellite.js adapter (TEMPORARY);
// Phase 4 adds our own SGP4 behind the same door, and tests prove the swap
// changes nothing a user can see.
// Learn: docs/learn/07-propagators.md
import type { Vec3 } from '../math/vec.ts'

/**
 * CCSDS Orbit Mean-elements Message fields as served by CelesTrak with
 * FORMAT=JSON. We use OMM, not TLE: TLE cannot represent catalog numbers
 * above 99999, which CelesTrak ran out of on 2026-07-11.
 */
export type OmmElements = {
  OBJECT_NAME: string
  OBJECT_ID: string
  EPOCH: string
  MEAN_MOTION: number
  ECCENTRICITY: number
  INCLINATION: number
  RA_OF_ASC_NODE: number
  ARG_OF_PERICENTER: number
  MEAN_ANOMALY: number
  EPHEMERIS_TYPE: number
  CLASSIFICATION_TYPE: string
  NORAD_CAT_ID: number
  ELEMENT_SET_NO: number
  REV_AT_EPOCH: number
  BSTAR: number
  MEAN_MOTION_DOT: number
  MEAN_MOTION_DDOT: number
}

export type StateVector = {
  /** Position in TEME, km. */
  rTeme: Vec3
  /** Velocity in TEME, km/s. */
  vTeme: Vec3
}

export interface Satellite {
  readonly noradId: number
  readonly name: string
  /** Element-set epoch, Unix ms (UTC). */
  readonly epochMs: number
  /** State at a UTC instant (Unix ms). Throws PropagationError if SGP4 fails (e.g. decayed). */
  propagate(unixMs: number): StateVector
}

export interface Propagator {
  /** Short id shown in the accuracy report, e.g. "satellitejs-7.1.0". */
  readonly id: string
  init(elements: OmmElements): Satellite
}

export class PropagationError extends Error {
  override name = 'PropagationError'
}

/** Orbital period ≥ 225 min means SDP4 (deep space) territory; our own SGP4 refuses it. */
export function isDeepSpace(elements: OmmElements): boolean {
  return 1440 / elements.MEAN_MOTION >= 225
}

/** OMM EPOCH ("2026-10-24T05:01:11.149248", UTC, no zone) → Unix ms. */
export function epochToUnixMs(epoch: string): number {
  const ms = Date.parse(epoch.endsWith('Z') ? epoch : `${epoch}Z`)
  if (Number.isNaN(ms)) throw new PropagationError(`Bad OMM EPOCH: ${epoch}`)
  return ms
}
