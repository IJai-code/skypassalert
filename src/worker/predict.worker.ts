/// <reference lib="webworker" />
// Runs the engine off the main thread so the page stays responsive on
// mid-range phones while a week of passes is computed (~50–150 ms).
// Learn: docs/learn/05-passes.md#worker
import { forecast, type ForecastRequest } from '../engine/index.ts'

export type WorkerRequest = { id: number; request: ForecastRequest }
export type WorkerResponse =
  | { id: number; ok: true; forecast: ReturnType<typeof forecast> }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, request } = event.data
  try {
    const result = forecast(request)
    self.postMessage({ id, ok: true, forecast: result } satisfies WorkerResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) } satisfies WorkerResponse)
  }
}
