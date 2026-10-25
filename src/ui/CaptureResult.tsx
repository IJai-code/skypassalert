// The finished shot: stacked and enhanced, with an honest before/after
// (press and hold), a caption computed from the sky model, and save/share.
// Nothing is uploaded: the image never leaves the phone unless you share it.
import { useEffect, useState } from 'react'
import type { ShotKind } from '../photo/stack.ts'

export type Capture = {
  after: string
  before: string
  width: number
  height: number
  caption: string
  info: string
  kind: ShotKind
}

/** Image + caption band as one shareable JPEG. */
async function captionedBlob(c: Capture): Promise<Blob | null> {
  const img = new Image()
  img.src = c.after
  await img.decode()
  const band = Math.round(Math.max(64, c.width * 0.09))
  const canvas = document.createElement('canvas')
  canvas.width = c.width
  canvas.height = c.height + band
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#05070f'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  await document.fonts?.load?.(`600 ${Math.round(band * 0.3)}px Archivo`).catch(() => undefined)
  ctx.fillStyle = '#eceff7'
  ctx.font = `600 ${Math.round(band * 0.3)}px Archivo, system-ui, sans-serif`
  ctx.fillText(c.caption, band * 0.35, c.height + band * 0.47, c.width - band * 0.7)
  ctx.fillStyle = '#ffc65c'
  ctx.font = `600 ${Math.round(band * 0.22)}px Archivo, system-ui, sans-serif`
  ctx.fillText('skypassalert.com', band * 0.35, c.height + band * 0.8)
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
}

export function CaptureResult({ capture, onClose }: { capture: Capture; onClose: () => void }) {
  const [showBefore, setShowBefore] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(
    () => () => {
      URL.revokeObjectURL(capture.after)
      URL.revokeObjectURL(capture.before)
    },
    [capture],
  )
  const fileName = `skypassalert-${capture.kind}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.jpg`

  const save = async () => {
    setBusy(true)
    const blob = await captionedBlob(capture)
    setBusy(false)
    if (!blob) return
    const file = new File([blob], fileName, { type: 'image/jpeg' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: capture.caption }).catch(() => undefined)
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your sky photo"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="hud-caps rounded-md bg-white/10 px-3 py-2"
        >
          Retake
        </button>
        <p className="hud-caps text-white/60">
          {showBefore ? 'One raw frame' : 'Stacked & enhanced'}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="hud-caps rounded-md bg-station px-3 py-2 text-black"
        >
          {busy ? 'Saving…' : 'Save / Share'}
        </button>
      </div>
      <button
        type="button"
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onPointerDown={() => setShowBefore(true)}
        onPointerUp={() => setShowBefore(false)}
        onPointerLeave={() => setShowBefore(false)}
        aria-label="Press and hold to compare with a single raw frame"
      >
        <img
          src={showBefore ? capture.before : capture.after}
          alt={capture.caption}
          className="max-h-full max-w-full object-contain"
        />
      </button>
      <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),18px)]">
        <p className="hud text-lg font-semibold">{capture.caption}</p>
        <p className="hud mt-1 text-[13px] text-white/60">{capture.info}</p>
        <p className="mt-2 text-xs text-white/45">
          Press and hold the photo to see one raw frame. Processed on your phone; nothing is
          uploaded.
        </p>
      </div>
    </div>
  )
}
