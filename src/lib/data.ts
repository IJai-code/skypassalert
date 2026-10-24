// Loads the orbital elements published by the Data workflow
// (public/data/elements.json). Our own static file: no third-party requests.
import type { OmmElements } from '../engine/index.ts'

export type ElementsDoc = {
  source: string
  fetchedAt: string
  objects: Array<OmmElements & { key: string }>
}

const CACHE_KEY = 'spa:elements'

export async function loadElements(): Promise<ElementsDoc> {
  try {
    const res = await fetch('/data/elements.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const doc = (await res.json()) as ElementsDoc
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(doc))
    } catch {
      // Private mode or storage full: fine, we just won't have an offline copy.
    }
    return doc
  } catch (err) {
    // Offline or the request failed: fall back to the last copy we saw.
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) return JSON.parse(cached) as ElementsDoc
    } catch {
      // ignore
    }
    throw err
  }
}
