// Small environment checks. User-agent sniffing is a last resort; we use it
// only to give in-app browser users exact "open in your browser" steps,
// never to block anything.

export type InAppBrowser = 'wechat' | 'facebook' | 'instagram' | 'line' | null

export function detectInAppBrowser(ua: string = navigator.userAgent): InAppBrowser {
  if (/MicroMessenger/i.test(ua)) return 'wechat'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV/i.test(ua)) return 'facebook'
  if (/\bLine\//i.test(ua)) return 'line'
  return null
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  )
}
