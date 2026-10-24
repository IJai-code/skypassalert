// satellite.js 7 can lazy-load a WebAssembly bulk propagator (with a pthreads
// worker). We propagate two objects at a time and don't use it, so vite.config.ts
// aliases its runtime imports here: no wasm or nested worker gets bundled.
export default function createWasmModule(): never {
  throw new Error('satellite.js WebAssembly runtime is not bundled in SkyPassAlert')
}
