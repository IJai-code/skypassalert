// The wave card: your sky and their view of you, side by side in one image,
// made on the phone (nothing is uploaded) and handed to the share sheet.
// Learn: docs/learn/14-wave-back.md
import type { ForecastPass, LatLon, OrbitSample } from '../../engine/index.ts'
import type { Place } from '../../engine/place.ts'
import { skyScene } from '../../engine/sky/scene.ts'
import type { StarCatalog } from '../../engine/stars/stars.ts'
import { drawSky } from '../../sky/drawSky.ts'
import { basisLookingAt } from '../../sky/projection.ts'
import { formatDate, formatTime } from '../../lib/format.ts'
import { stationName } from '../../copy/en.ts'
import { postcardView } from '../stageView.ts'
import { drawGlobe } from './drawGlobe.ts'
import type { Earth } from './earth.ts'

const W = 1080
const H = 1350

type Card = {
  pass: ForecastPass
  place: Place
  catalog: StarCatalog | null
  earth: Earth | null
  subsolar: LatLon
  station: OrbitSample
  caption: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function renderWaveCard(c: Card): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  const tz = c.place.timeZone
  const half = 600

  // Top: your sky, facing the pass, with its path minute by minute.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, half)
  ctx.clip()
  const scene = skyScene(c.place, c.pass.peak.unixMs, c.catalog)
  const start = skyScene(c.place, c.pass.start.unixMs, null)
  drawSky(ctx, {
    vp: { width: W, height: half, vfovDeg: 120, projection: 'stereographic', cy: half * 0.4 },
    cam: basisLookingAt(postcardView(c.pass).az, 38),
    scene: { ...scene, sun: start.sun },
    catalog: c.catalog,
    opaque: true,
    red: false,
    track: c.pass.track,
    station: null,
    formatMinute: (ms) => formatTime(ms, tz).replace(/\s?[AP]M$/, ''),
    labels: true,
  })
  ctx.restore()

  // Bottom: Earth from above the station at the peak.
  ctx.save()
  ctx.translate(0, half)
  ctx.beginPath()
  ctx.rect(0, 0, W, H - half)
  ctx.clip()
  drawGlobe(
    ctx,
    { width: W, height: H - half, centre: c.station, cy: 0.42 },
    {
      earth: c.earth,
      subsolar: c.subsolar,
      samples: c.pass.station.samples,
      passFrom: c.pass.start.unixMs,
      passTo: c.pass.end.unixMs,
      station: c.station,
      you: {
        latDeg: c.place.latDeg,
        lonDeg: c.place.lonDeg,
        label: c.place.name.split(',')[0] ?? '',
      },
      red: false,
    },
  )
  ctx.restore()

  // Words.
  const name = stationName(c.pass.noradId).short
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, half - 2, W, 4)
  shadowText(
    ctx,
    'YOU LOOKED UP',
    56,
    84,
    '600 30px system-ui, sans-serif',
    'rgba(236,242,247,0.85)',
  )
  shadowText(
    ctx,
    `${name} · ${formatTime(c.pass.start.unixMs, tz)}`,
    56,
    150,
    '800 64px system-ui, sans-serif',
    '#ffffff',
  )
  shadowText(
    ctx,
    `${formatDate(c.pass.start.unixMs, tz)} · ${c.place.name}`,
    56,
    200,
    '500 30px system-ui, sans-serif',
    'rgba(236,242,247,0.85)',
  )
  shadowText(
    ctx,
    'THEY LOOKED DOWN',
    56,
    half + 70,
    '600 30px system-ui, sans-serif',
    'rgba(236,242,247,0.85)',
  )

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, H - 150, W, 150)
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillStyle = '#ffc65c'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText('skypassalert.com', 56, H - 62)
  ctx.font = '500 26px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(236,242,247,0.8)'
  ctx.fillText('Look up tonight. Free, no account.', 56, H - 100)
  try {
    const qr = await loadImage('/qr.svg')
    ctx.fillStyle = '#fff'
    ctx.fillRect(W - 56 - 112, H - 136, 112, 112)
    ctx.drawImage(qr, W - 56 - 104, H - 128, 96, 96)
  } catch {
    // The card still works without the code.
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}

function shadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
) {
  ctx.save()
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 12
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** Opens the share sheet where it exists; otherwise saves the PNG. */
export async function shareWaveCard(c: Card): Promise<'shared' | 'saved'> {
  const blob = await renderWaveCard(c)
  const file = new File([blob], `wave-${stationName(c.pass.noradId).short.toLowerCase()}.png`, {
    type: 'image/png',
  })
  const data = { files: [file], text: `${c.caption} https://skypassalert.com/?s=wave` }
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
