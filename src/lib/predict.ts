// Main-thread client for the prediction worker.
import type { Forecast, ForecastRequest } from '../engine/index.ts'
import type { WorkerRequest, WorkerResponse } from '../worker/predict.worker.ts'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (r: WorkerResponse) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/predict.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      pending.get(e.data.id)?.(e.data)
      pending.delete(e.data.id)
    }
  }
  return worker
}

export function requestForecast(request: ForecastRequest): Promise<Forecast> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, (r) => (r.ok ? resolve(r.forecast) : reject(new Error(r.error))))
    getWorker().postMessage({ id, request } satisfies WorkerRequest)
  })
}
