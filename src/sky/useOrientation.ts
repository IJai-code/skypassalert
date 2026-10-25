// React hook: live sky camera from the phone's motion sensors, corrected to
// true north. Falls back to "none" on devices without sensors (most laptops),
// where Sky View switches to drag-to-look.
// Learn: docs/learn/11-compass.md
import { useCallback, useEffect, useRef, useState } from 'react'
import { cameraFromDevice, forwardAzimuth, smoothBasis } from './orientation.ts'
import type { CameraBasis } from './projection.ts'

export type SensorStatus = 'idle' | 'asking' | 'active' | 'denied' | 'unavailable'

type IOSOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}
type PermissionAPI = { requestPermission?: () => Promise<'granted' | 'denied'> }

/** iOS needs a user gesture to grant motion access; call this from a click handler. */
export async function requestMotionPermission(): Promise<boolean> {
  const api = (globalThis.DeviceOrientationEvent as unknown as PermissionAPI | undefined)
    ?.requestPermission
  if (!api) return true // Android/desktop: no prompt needed
  try {
    return (await api()) === 'granted'
  } catch {
    return false
  }
}

const circularBlend = (prev: number, next: number, k: number) => {
  let d = next - prev
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return (prev + d * k + 360) % 360
}

export function useOrientation(enabled: boolean, declinationDeg: number) {
  const [status, setStatus] = useState<SensorStatus>('idle')
  const [accuracyDeg, setAccuracyDeg] = useState<number | null>(null)
  const camRef = useRef<CameraBasis | null>(null)
  const iosOffset = useRef<number | null>(null)
  const calibration = useRef(0)
  // Bumped by restart(): re-attaches listeners after a late permission grant.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let got = false
    const screenAngle = () =>
      screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0

    const handle = (e: DeviceOrientationEvent, absolute: boolean) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return
      const ios = e as IOSOrientationEvent
      let headingFix = declinationDeg + calibration.current
      if (typeof ios.webkitCompassHeading === 'number') {
        // iOS: alpha has an arbitrary zero; webkitCompassHeading is magnetic heading.
        // Learn the offset while the phone is held up (reliable heading), smoothly.
        const rel = forwardAzimuth(e.alpha, e.beta, e.gamma)
        const target = (ios.webkitCompassHeading - rel + 360) % 360
        const elevationOk = e.beta > 30 && e.beta < 150
        if (iosOffset.current === null) iosOffset.current = target
        else if (elevationOk) iosOffset.current = circularBlend(iosOffset.current, target, 0.05)
        headingFix += iosOffset.current
        if (typeof ios.webkitCompassAccuracy === 'number' && ios.webkitCompassAccuracy >= 0) {
          setAccuracyDeg(ios.webkitCompassAccuracy)
        }
      } else if (!absolute && !e.absolute) {
        return // relative-only data can't point at the real sky
      }
      const next = cameraFromDevice(e.alpha, e.beta, e.gamma, screenAngle(), headingFix)
      camRef.current = smoothBasis(camRef.current, next, 0.6)
      if (!got) {
        got = true
        setStatus('active')
      }
    }
    const onAbs = (e: Event) => handle(e as DeviceOrientationEvent, true)
    const onRel = (e: Event) => handle(e as DeviceOrientationEvent, false)
    const hasAbsolute = 'ondeviceorientationabsolute' in window
    if (hasAbsolute) window.addEventListener('deviceorientationabsolute', onAbs)
    window.addEventListener('deviceorientation', onRel)
    const timer = setTimeout(() => {
      if (!got) setStatus((s) => (s === 'denied' ? s : 'unavailable'))
    }, 1500)
    return () => {
      clearTimeout(timer)
      if (hasAbsolute) window.removeEventListener('deviceorientationabsolute', onAbs)
      window.removeEventListener('deviceorientation', onRel)
    }
  }, [enabled, declinationDeg, attempt])

  /** Shift the heading so the camera's current direction becomes `trueAzDeg`. */
  const calibrateTo = useCallback((trueAzDeg: number) => {
    const cam = camRef.current
    if (!cam) return
    const az = (Math.atan2(cam.forward[0], cam.forward[1]) * 180) / Math.PI
    let d = trueAzDeg - az
    if (d > 180) d -= 360
    if (d < -180) d += 360
    calibration.current += d
  }, [])

  /** Sky Sync: shift the heading by part of a measured error (degrees, + = clockwise). */
  const nudgeYaw = useCallback((deltaDeg: number) => {
    calibration.current += deltaDeg
  }, [])

  return {
    status,
    setStatus,
    camRef,
    accuracyDeg,
    calibrateTo,
    nudgeYaw,
    restart: () => {
      iosOffset.current = null
      setStatus('idle')
      setAttempt((a) => a + 1)
    },
    calibrationDeg: () => calibration.current,
  }
}
