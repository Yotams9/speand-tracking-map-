/**
 * Icons, hand-authored as inline SVG.
 *
 * An icon library would be a dependency for ~18 glyphs, and would drag in a
 * house style that is not this product's. These share one grid (24px), one
 * stroke weight, and one cap style, which is what makes a set feel like a set.
 */

interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconMap = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 3.5 3.5 6v14.5L9 18l6 2.5 5.5-2.5V3.5L15 6Z" />
    <path d="M9 3.5V18M15 6v14.5" />
  </svg>
)

export const IconSpark = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9Z" />
    <path d="M18.4 15.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
  </svg>
)

export const IconPlus = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
)

export const IconInbox = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 13.5 6 5.2A1.6 1.6 0 0 1 7.5 4h9A1.6 1.6 0 0 1 18 5.2l2.5 8.3v4.1a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" />
    <path d="M3.5 13.5h4l1.2 2.2h6.6l1.2-2.2h4" />
  </svg>
)

export const IconPerson = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
  </svg>
)

export const IconChevron = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m9.5 5.5 6.2 6.5-6.2 6.5" />
  </svg>
)

export const IconArrowBack = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
)

export const IconClose = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
)

export const IconCheck = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2}>
    <path d="m5 12.5 4.6 4.5L19 6.8" />
  </svg>
)

export const IconReceipt = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5.5 3.6h13v16.8l-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5-2.2-1.5-2.1 1.5Z" />
    <path d="M9 8.4h6M9 12.2h6M9 16h3.5" />
  </svg>
)

export const IconBarcode = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6.5v11M7.4 6.5v11M10.6 6.5v11M14 6.5v11M17 6.5v11M20 6.5v11" />
  </svg>
)

export const IconProducts = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.2 8.2 12 4.5l7.8 3.7v7.6L12 19.5l-7.8-3.7Z" />
    <path d="M4.2 8.2 12 12l7.8-3.8M12 12v7.5" />
  </svg>
)

export const IconUpload = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 15.5V4.8M8.2 8.4 12 4.6l3.8 3.8" />
    <path d="M4.5 14.5v3.2a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-3.2" />
  </svg>
)

export const IconPencil = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.6 19.4h3.1L18.5 8.6a1.8 1.8 0 0 0 0-2.5l-.6-.6a1.8 1.8 0 0 0-2.5 0L4.6 16.3Z" />
  </svg>
)

export const IconCamera = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.6 8.6A1.8 1.8 0 0 1 5.4 6.8h2.2l1.3-2h6.2l1.3 2h2.2a1.8 1.8 0 0 1 1.8 1.8v8.6a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8Z" />
    <circle cx="12" cy="12.6" r="3.4" />
  </svg>
)

export const IconLock = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="4.8" y="10.4" width="14.4" height="9.2" rx="2" />
    <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
  </svg>
)

export const IconClock = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 7.4V12l3 1.8" />
  </svg>
)

export const IconCar = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 15.4v2.4M20 15.4v2.4" />
    <path d="M3.4 15.4v-3l1.8-4.2A1.8 1.8 0 0 1 6.9 7h10.2a1.8 1.8 0 0 1 1.7 1.2l1.8 4.2v3Z" />
    <path d="M3.4 12.4h17.2M7 15.4h2M15 15.4h2" />
  </svg>
)

export const IconPin = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s6.4-6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.4" />
  </svg>
)

export const IconRepeat = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.6 10.4A5 5 0 0 1 9.5 6h9M15.6 3l3 3-3 3" />
    <path d="M19.4 13.6A5 5 0 0 1 14.5 18h-9M8.4 21l-3-3 3-3" />
  </svg>
)

export const IconTrend = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 16.4 9.2 11l3.4 3.4L20 7" />
    <path d="M15.4 7H20v4.6" />
  </svg>
)

export const IconGlobe = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M3.6 12h16.8M12 3.6a13 13 0 0 1 0 16.8 13 13 0 0 1 0-16.8Z" />
  </svg>
)

export const IconInfo = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v5.2M12 7.9v.2" />
  </svg>
)
