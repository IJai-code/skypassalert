import '@testing-library/jest-dom/vitest'

// jsdom has no layout engine: stub ResizeObserver, and let canvas getContext
// return null quietly (the sky renderer skips drawing when it gets null).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement['getContext']
}
