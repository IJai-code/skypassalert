// The rear camera as a live backdrop for Sky View. Optional: the rendered
// sky works without it, and at night the camera mostly shows black.
import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'off' | 'starting' | 'on' | 'blocked'

export function useCamera(on: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [status, setStatus] = useState<Exclude<CameraStatus, 'off'>>('starting')

  useEffect(() => {
    if (!on) return
    let stream: MediaStream | null = null
    let cancelled = false
    const request =
      navigator.mediaDevices?.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      }) ?? Promise.reject(new Error('No camera API'))
    request
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        trackRef.current = s.getVideoTracks()[0] ?? null
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play().catch(() => undefined)
        }
        setStatus('on')
      })
      .catch(() => {
        if (!cancelled) setStatus('blocked')
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
      setStatus('starting')
    }
  }, [on])

  return { videoRef, trackRef, status: (on ? status : 'off') as CameraStatus }
}
