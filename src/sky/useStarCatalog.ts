// Loads the bright-star catalogue (~10 KB gzipped) on demand, outside the
// initial bundle.
import { useEffect, useState } from 'react'
import type { StarCatalog } from '../engine/stars/stars.ts'

let cached: StarCatalog | null = null

export function useStarCatalog(): StarCatalog | null {
  const [catalog, setCatalog] = useState<StarCatalog | null>(cached)
  useEffect(() => {
    if (cached) return
    let alive = true
    import('../engine/stars/bright-stars.json').then((m) => {
      cached = m.default as unknown as StarCatalog
      if (alive) setCatalog(cached)
    })
    return () => {
      alive = false
    }
  }, [])
  return catalog
}
