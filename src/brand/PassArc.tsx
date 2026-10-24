// Decorative hero: a station gliding along its pass arc and fading out before
// the horizon, as real passes often do when the station enters Earth's shadow.
// SVG <animateMotion> scales with the viewBox (CSS offset-path would not).
import { useId, useSyncExternalStore } from 'react'

const ARC = 'M 20 150 A 140 120 0 0 1 300 150'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia?.(REDUCED_MOTION)
  mql?.addEventListener('change', onChange)
  return () => mql?.removeEventListener('change', onChange)
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false
}

type PassArcProps = { className?: string }

export function PassArc({ className }: PassArcProps) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true)
  const glow = `${useId()}-glow`

  return (
    <svg viewBox="0 0 320 172" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF4D6" />
          <stop offset="0.3" stopColor="#FFC65C" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFC65C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={ARC}
        fill="none"
        stroke="#9AA4C2"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <line x1="0" y1="150" x2="320" y2="150" stroke="#2A3566" strokeWidth="2" />
      <text x="20" y="168" fill="#9AA4C2" fontSize="12" textAnchor="middle">
        NW
      </text>
      <text x="300" y="168" fill="#9AA4C2" fontSize="12" textAnchor="middle">
        SE
      </text>

      {reduced ? (
        <g transform="translate(214 47)">
          <circle r="14" fill={`url(#${glow})`} />
          <circle r="3.5" fill="#FFF4D6" />
        </g>
      ) : (
        <g opacity="0">
          <circle r="14" fill={`url(#${glow})`} />
          <circle r="3.5" fill="#FFF4D6" />
          <animateMotion
            dur="9s"
            repeatCount="indefinite"
            path={ARC}
            keyPoints="0;0.82;0.82"
            keyTimes="0;0.92;1"
            calcMode="linear"
          />
          <animate
            attributeName="opacity"
            dur="9s"
            repeatCount="indefinite"
            values="0;1;1;0;0"
            keyTimes="0;0.1;0.8;0.92;1"
          />
        </g>
      )}
    </svg>
  )
}
