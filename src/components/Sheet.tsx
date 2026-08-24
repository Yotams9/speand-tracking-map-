import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLocale } from '@/i18n'
import { IconClose } from './Icons'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * A bottom sheet on phones, a docked side panel on desktop.
 *
 * The point of a sheet rather than a route here is context: selecting a place
 * on the map should not take the map away. Escape and a tap outside both close
 * it, and focus moves in on open and back out on close.
 */
export function Sheet({ open, onClose, title, subtitle, children }: Props) {
  const { t } = useLocale()
  const ref = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      // Keep Tab inside the sheet while it is the active surface.
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    // Focus the panel itself rather than its first control, so a screen reader
    // announces what opened before what can be done in it.
    const id = window.setTimeout(() => ref.current?.focus(), 30)

    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(id)
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 className="heading" id={titleId}>{title}</h2>
            {subtitle && <p className="caption" style={{ marginBlockStart: 2 }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  )
}
