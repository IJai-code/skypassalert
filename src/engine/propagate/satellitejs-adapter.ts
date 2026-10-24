// TEMPORARY: satellite.js behind our Propagator interface, so v0.1 can launch
// before our own SGP4 (Phase 4) exists. Kept afterwards as a test oracle.
// Learn: docs/learn/07-propagators.md
import { json2satrec, sgp4, type OMMJsonObject } from 'satellite.js'
import { MS_PER_DAY } from '../math/constants.ts'
import { jdUtc } from '../time/julian.ts'
import {
  PropagationError,
  epochToUnixMs,
  type OmmElements,
  type Propagator,
  type Satellite,
} from './propagator.ts'

export const satelliteJsPropagator: Propagator = {
  id: 'satellitejs-7.1.0',
  init(elements: OmmElements): Satellite {
    // CelesTrak's JSON matches the OMM keys satellite.js expects.
    const satrec = json2satrec(elements as unknown as OMMJsonObject)
    if (satrec.error) throw new PropagationError(`satellite.js init error ${satrec.error}`)
    return {
      noradId: elements.NORAD_CAT_ID,
      name: elements.OBJECT_NAME,
      epochMs: epochToUnixMs(elements.EPOCH),
      propagate(unixMs: number) {
        // Minutes since epoch on the UTC scale, as SGP4 defines tsince.
        const tsince = ((jdUtc(unixMs) - satrec.jdsatepoch) * MS_PER_DAY) / 60_000
        const out = sgp4(satrec, tsince)
        if (!out) throw new PropagationError(`SGP4 failed for ${elements.OBJECT_NAME}`)
        const { position: r, velocity: v } = out
        return { rTeme: [r.x, r.y, r.z], vTeme: [v.x, v.y, v.z] }
      },
    }
  },
}
