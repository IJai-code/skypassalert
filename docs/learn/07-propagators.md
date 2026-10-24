# 07 · Propagators: why an interface?

Code: `src/engine/propagate/` (`propagator.ts`, `satellitejs-adapter.ts`, `no-wasm.ts`).

## The idea
"Where will the station be at time t?" is answered by **SGP4**, the standard model that goes with published orbital elements. It accounts for Earth's bulge (J2–J4) and atmospheric drag (B*). Phase 4 ports our own SGP4 from Vallado's published reference. Until then, the open-source **satellite.js** does the job, behind an interface so the swap can't change anything else:

```ts
interface Propagator { id: string; init(elements: OmmElements): Satellite }
interface Satellite  { noradId; name; epochMs; propagate(unixMs): { rTeme, vTeme } }
```

## Why OMM, not TLE
CelesTrak serves elements as **OMM** (a CCSDS standard) in JSON. Since 2026-07-11 new objects get 6-digit catalog numbers, which the 69-column TLE format can't hold, and CelesTrak is phasing TLE out. We request `FORMAT=JSON` and read OMM fields directly (`json2satrec`).

## Details that matter
- SGP4's "time since epoch" is in **UTC** minutes: `tsince = (JD_UTC − JD_epoch)·1440`.
- **Deep space:** orbits with periods ≥ 225 min need the SDP4 extension (Sun/Moon gravity, resonances). `isDeepSpace()` flags them; our own SGP4 will refuse them with a clear error rather than give a wrong answer.
- satellite.js 7 ships an optional WebAssembly bulk propagator with a pthreads worker. We alias its runtime imports to `no-wasm.ts`, so none of that is bundled (the worker is 18 KB gzipped).

## Phase 4 plan
Add `skypass-sgp4` behind the same interface. Run both on the Vallado test vectors and on every pass in a week for 50 random places, and require user-visible fields to match within documented tolerances (times to the second, directions to 1°, magnitudes to 0.1). Then make ours the default and keep satellite.js as the test oracle.
