// Exact steps to leave an in-app browser. Shown only when an action needs it.
import { useEffect, useRef } from 'react'
import { detectInAppBrowser, type InAppBrowser } from '../lib/env.ts'

const STEPS: Record<Exclude<InAppBrowser, null>, { en: string; zh?: string }> = {
  wechat: {
    en: 'Tap ··· in the top-right corner, then “Open in Browser”.',
    zh: '点右上角的 ···，再选择“在浏览器打开”。',
  },
  facebook: { en: 'Tap ··· in the corner, then “Open in external browser”.' },
  instagram: { en: 'Tap ··· in the top-right corner, then “Open in external browser”.' },
  line: { en: 'Tap the share icon, then “Open in default browser”.' },
}

export function InAppBrowserSheet({ onClose }: { onClose: () => void }) {
  const kind = detectInAppBrowser() ?? 'wechat'
  const steps = STEPS[kind]
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal?.()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="inapp-title"
      className="m-auto mb-0 w-full max-w-lg rounded-t-xl border border-hair-strong bg-night-2 p-6 text-ink backdrop:bg-black/60 sm:mb-auto sm:rounded-xl"
    >
      <h2 id="inapp-title" className="text-xl font-semibold">
        Open this in your phone’s browser
      </h2>
      <p className="mt-2 text-ink-2">
        This app’s built-in browser can’t save calendar reminders. Everything else works here.
      </p>
      <p className="mt-4 text-lg">{steps.en}</p>
      {steps.zh && (
        <p
          lang="zh-Hans"
          className="mt-1 text-lg text-ink-2"
          data-translation-status="needs-native-review"
        >
          {steps.zh}
        </p>
      )}
      <form method="dialog" className="mt-6">
        <button
          type="submit"
          className="rounded-md border border-hair-strong px-4 py-2 font-medium hover:bg-night"
        >
          Got it
        </button>
      </form>
    </dialog>
  )
}
