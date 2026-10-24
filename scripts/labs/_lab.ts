// Shared helpers for "predict, then run" labs (docs/learn/00-start-here.md#labs).
import { createInterface } from 'node:readline/promises'
import { readFileSync } from 'node:fs'
import type { OmmElements } from '../../src/engine/propagate/propagator.ts'

/** Ask the reader to commit to a prediction before showing the answer. */
export async function predict(question: string): Promise<void> {
  console.log(`\n\x1b[1mPredict first:\x1b[0m ${question}`)
  console.log('Write your answer in ENGINEERING_LOG.md before you look.')
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('Press Enter when you have written it down… ')
    rl.close()
  }
  console.log('')
}

/** The elements the site is currently serving. */
export function currentElements(): OmmElements[] {
  const doc = JSON.parse(
    readFileSync(new URL('../../public/data/elements.json', import.meta.url), 'utf8'),
  )
  return doc.objects as OmmElements[]
}

export const FREMONT = {
  id: 'fremont-ca-us',
  name: 'Fremont, CA',
  latDeg: 37.54827,
  lonDeg: -121.98857,
  elevationM: 17,
  timeZone: 'America/Los_Angeles',
}

export const fmt = (ms: number, tz = FREMONT.timeZone) =>
  new Date(ms).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
