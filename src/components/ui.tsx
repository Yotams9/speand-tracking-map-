import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { getMerchant, totalOf } from '@/data/derive'
import type { Purchase } from '@/data/types'
import { categoryColor } from './categories'
import { IconChevron, IconInfo, IconLock } from './Icons'
import styles from './ui.module.css'

/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon, title, body, action,
}: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <h3 className="heading">{title}</h3>
      {body && <p className={`sub ${styles.emptyBody}`}>{body}</p>}
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function Stats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className={styles.stats}>
      {items.map((s) => (
        <div key={s.label} className={styles.stat}>
          <span className={`${styles.statValue} num`}>{s.value}</span>
          <span className={styles.statLabel}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const { L, money, relativeDay, time } = useLocale()
  const merchant = purchase.merchantId ? getMerchant(purchase.merchantId) : undefined
  if (!merchant) return null

  const branch = merchant.branch ? ` · ${L(merchant.branch)}` : ''

  return (
    <Link to={`/purchase/${purchase.id}`} className={styles.pRow}>
      <span
        className={styles.pDot}
        style={{ background: categoryColor(merchant.category) }}
        aria-hidden="true"
      />
      <span className={styles.pMain}>
        <span className={styles.pName}>{L(merchant.name)}{branch}</span>
        <span className={styles.pMeta}>
          {relativeDay(purchase.timestamp)} · {time(purchase.timestamp)}
        </span>
      </span>
      <span className={`${styles.pAmount} num`}>{money(totalOf(purchase))}</span>
      <IconChevron size={18} className="chevron" />
    </Link>
  )
}

/* -------------------------------------------------------------------------- */

interface InsightProps {
  kicker: string
  icon: ReactNode
  tint: string
  figure?: string
  title: string
  body: string
  cta?: string
  to?: string
  children?: ReactNode
}

/**
 * The unit of the For You screen: one thing worth knowing, readable in a couple
 * of seconds, with exactly one next step.
 */
export function InsightCard({
  kicker, icon, tint, figure, title, body, cta, to, children,
}: InsightProps) {
  const inner = (
    <>
      <div className={styles.insightHead}>
        <span
          className={styles.insightIcon}
          style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
        >
          {icon}
        </span>
        <span className="kicker">{kicker}</span>
      </div>

      {figure && <span className={`${styles.insightFigure} num gain`}>{figure}</span>}
      <h3 className="heading" style={{ marginBlockStart: figure ? 6 : 0 }}>{title}</h3>
      <p className={styles.insightBody}>{body}</p>
      {children}
      {cta && (
        <span className={styles.insightFoot}>
          {cta}
          <IconChevron size={16} className="chevron" />
        </span>
      )}
    </>
  )

  if (to) {
    return <Link to={to} className={styles.insight}>{inner}</Link>
  }
  return <div className={styles.insight}>{inner}</div>
}

/* -------------------------------------------------------------------------- */

export function Section({
  title, action, children,
}: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className="heading">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/* -------------------------------------------------------------------------- */

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note}>
      <IconInfo size={15} />
      <span>{children}</span>
    </p>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * A control that is intentionally not wired up.
 *
 * Rendered as disabled and labelled, never as a button that silently does
 * nothing — a dead control reads as a bug, an explicitly deferred one reads as
 * a decision.
 */
export function DeferredRow({
  title, body,
}: { title: string; body?: string }) {
  const { t } = useLocale()
  return (
    <div className={styles.deferred} aria-disabled="true">
      <IconLock size={18} />
      <span className={styles.pMain}>
        <span className={styles.pName}>{title}</span>
        {body && <span className={styles.pMeta}>{body}</span>}
      </span>
      <span className="badge badge-soon">{t('common.notInThisPhase')}</span>
    </div>
  )
}
