// Per-target camera settings where the browser allows them.
// Chrome on many Android phones exposes manual exposure, ISO and focus
// (W3C Image Capture: exposureTime is in units of 100 µs). Safari on iPhone
// does not, so there we rely on stacking, and offer the native camera
// for the very best single shot. We always report what we actually set.
import type { ShotKind } from './stack.ts'

type Range = { min: number; max: number; step?: number }
type Caps = MediaTrackCapabilities & {
  exposureMode?: string[]
  exposureTime?: Range
  iso?: Range
  focusMode?: string[]
  focusDistance?: Range
  zoom?: Range
}

export type Applied = { label: string; manual: boolean }

const PRESET: Record<ShotKind, { exposureSec: number; iso: 'min' | 'mid' | 'max'; zoom: number }> =
  {
    moon: { exposureSec: 1 / 250, iso: 'min', zoom: 3 },
    planet: { exposureSec: 1 / 60, iso: 'mid', zoom: 3 },
    stars: { exposureSec: 1 / 4, iso: 'max', zoom: 1 },
    trail: { exposureSec: 1 / 8, iso: 'max', zoom: 1 },
  }

const clamp = (v: number, r: Range) => Math.min(r.max, Math.max(r.min, v))

export async function applyPreset(
  track: MediaStreamTrack | null,
  kind: ShotKind,
): Promise<Applied> {
  const caps = (track?.getCapabilities?.() ?? {}) as Caps
  const p = PRESET[kind]
  const advanced: Record<string, unknown> = {}
  const parts: string[] = []
  let manual = false
  if (caps.exposureMode?.includes('manual') && caps.exposureTime) {
    advanced.exposureMode = 'manual'
    advanced.exposureTime = clamp(p.exposureSec * 10_000, caps.exposureTime)
    const sec = (advanced.exposureTime as number) / 10_000
    parts.push(sec >= 0.5 ? `${sec.toFixed(1)} s` : `1/${Math.round(1 / sec)} s`)
    manual = true
    if (caps.iso) {
      const iso =
        p.iso === 'min'
          ? caps.iso.min
          : p.iso === 'max'
            ? caps.iso.max
            : (caps.iso.min + caps.iso.max) / 4
      advanced.iso = clamp(iso, caps.iso)
      parts.push(`ISO ${Math.round(advanced.iso as number)}`)
    }
  }
  if (caps.focusMode?.includes('manual') && caps.focusDistance) {
    advanced.focusMode = 'manual'
    advanced.focusDistance = caps.focusDistance.max // as far as the lens goes: the sky
    parts.push('focus ∞')
    manual = true
  }
  if (caps.zoom && p.zoom > 1) {
    advanced.zoom = clamp(p.zoom, caps.zoom)
    parts.push(`${(advanced.zoom as number).toFixed(1)}× zoom`)
  }
  if (track && Object.keys(advanced).length) {
    try {
      await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] })
    } catch {
      return { label: 'Automatic exposure (this phone refused manual settings)', manual: false }
    }
  }
  return manual
    ? { label: parts.join(' · '), manual: true }
    : {
        label: parts.length
          ? `${parts.join(' · ')} · automatic exposure`
          : 'Automatic exposure (this browser doesn’t allow manual camera control)',
        manual: false,
      }
}

export async function resetPreset(track: MediaStreamTrack | null): Promise<void> {
  const caps = (track?.getCapabilities?.() ?? {}) as Caps
  const advanced: Record<string, unknown> = {}
  if (caps.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous'
  if (caps.focusMode?.includes('continuous')) advanced.focusMode = 'continuous'
  if (track && Object.keys(advanced).length) {
    await track
      .applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] })
      .catch(() => undefined)
  }
}
