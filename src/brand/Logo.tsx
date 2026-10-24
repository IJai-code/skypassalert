// Original SkyPassAlert mark: horizon, a dotted pass track, and the station
// as a sunlit amber point. Kept in sync with public/favicon.svg.
// Brand notes: docs/PRODUCT.md#brand
import { useId } from 'react'

type LogoProps = {
  size?: number
  /** Accessible name; pass "" when the logo sits inside an already-labelled link. */
  title?: string
}

export function Logo({ size = 48, title = 'SkyPassAlert logo' }: LogoProps) {
  // Unique ids so several logos on one page don't share gradient/clip refs.
  const id = useId()
  const glow = `${id}-glow`
  const clip = `${id}-clip`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <defs>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE3A3" />
          <stop offset="0.35" stopColor="#FFC65C" />
          <stop offset="1" stopColor="#FFC65C" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#0B1026" stroke="#2A3566" strokeWidth="2" />
      <g clipPath={`url(#${clip})`}>
        <path
          d="M10 46 A22 28 0 0 1 54 46"
          fill="none"
          stroke="#9AA4C2"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 5"
        />
        <line x1="0" y1="46" x2="64" y2="46" stroke="#E8ECF8" strokeWidth="2.5" />
        <circle cx="20" cy="16" r="1.4" fill="#E8ECF8" />
        <circle cx="50" cy="12" r="1" fill="#E8ECF8" opacity="0.7" />
      </g>
      <circle cx="43" cy="21.8" r="9" fill={`url(#${glow})`} />
      <circle cx="43" cy="21.8" r="3.6" fill="#FFF4D6" />
    </svg>
  )
}
