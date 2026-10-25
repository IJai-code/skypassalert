import type { ForecastPass } from '../engine/index.ts'

/** Which way to face for a pass: the circular mean azimuth of its first half. */
export function postcardView(pass: ForecastPass) {
  const n = pass.track.length
  const lead = pass.track.slice(0, Math.max(2, Math.ceil(n * 0.55)))
  let x = 0
  let y = 0
  for (const p of lead) {
    x += Math.sin((p.azDeg * Math.PI) / 180)
    y += Math.cos((p.azDeg * Math.PI) / 180)
  }
  return { az: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360 }
}
