/// <reference lib="webworker" />
// Stacking runs off the main thread: a 24-frame Moon stack is ~40 MB of
// pixels and a few hundred ms of arithmetic on a phone.
import { enhance, stack, type ShotKind } from './stack.ts'

export type StackRequest = {
  kind: ShotKind
  frames: Array<{ buffer: ArrayBuffer; width: number; height: number }>
}
export type StackResponse =
  | {
      ok: true
      after: ArrayBuffer
      before: ArrayBuffer
      width: number
      height: number
      used: number
    }
  | { ok: false; error: string }

self.onmessage = (e: MessageEvent<StackRequest>) => {
  try {
    const frames = e.data.frames.map((f) => ({
      data: new Uint8ClampedArray(f.buffer),
      width: f.width,
      height: f.height,
    }))
    const result = stack(frames, e.data.kind)
    const after = enhance(result, e.data.kind)
    // "Before": the first frame, untouched, for an honest comparison.
    const before = frames[0]!.data
    const msg: StackResponse = {
      ok: true,
      after: after.buffer as ArrayBuffer,
      before: before.buffer as ArrayBuffer,
      width: result.width,
      height: result.height,
      used: result.used,
    }
    ;(self as unknown as Worker).postMessage(msg, [msg.after, msg.before])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({
      ok: false,
      error: String(err),
    } satisfies StackResponse)
  }
}
