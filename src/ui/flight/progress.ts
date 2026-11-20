// How far you've scrolled through the Flight, smoothed. The page scrolls
// natively (no scroll-jacking); the film chases that position through a
// critically damped follow, so a flick of the thumb glides instead of jerking.
// Learn: docs/learn/16-the-flight.md#timeline

type Sub = (p: number) => void

/** About 0.12 s to close most of the gap: quick, but never a jump. */
const TAU_S = 0.12

export class Progress {
  private target = 0
  private shown = 0
  private raf = 0
  private last = 0
  private subs = new Set<Sub>()

  /** Reduced motion: no glide, the film follows the scroll exactly. */
  constructor(private readonly reduced = false) {}

  get value() {
    return this.shown
  }

  set(p: number) {
    this.target = p
    if (this.reduced) {
      this.shown = p
      this.emit()
      return
    }
    if (!this.raf) {
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  /** Go straight to p, no glide (a new pass, or opening the page mid-way). */
  jump(p: number) {
    this.stop()
    this.target = p
    this.shown = p
    this.emit()
  }

  /** Redraw everyone at the current position (after a resize or new data). */
  poke() {
    this.emit()
  }

  subscribe(fn: Sub): () => void {
    this.subs.add(fn)
    fn(this.shown)
    return () => {
      this.subs.delete(fn)
    }
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private tick = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.shown += (this.target - this.shown) * (1 - Math.exp(-dt / TAU_S))
    if (Math.abs(this.target - this.shown) < 2e-4) {
      this.shown = this.target
      this.raf = 0
    } else {
      this.raf = requestAnimationFrame(this.tick)
    }
    this.emit()
  }

  private emit() {
    for (const s of this.subs) s(this.shown)
  }
}
