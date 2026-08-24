import { useMemo } from 'react'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { DUE_RATIO, compareBasket, getMerchant, likelyNeededSoon } from '@/data/derive'
import { fixtures } from '@/data/fixtures'
import { Page } from '@/components/AppShell'
import { EmptyState, Note, Section } from '@/components/ui'
import { IconCheck, IconClose } from '@/components/Icons'
import styles from './detail.module.css'

/**
 * "Likely needed soon".
 *
 * Derived from observed repurchase intervals, not from a list anyone maintains.
 * Dismissing an item is allowed but deliberately low-ceremony — if this screen
 * ever starts feeling like housekeeping, it has failed.
 */
export function LikelyNeeded() {
  const { t, L, money, number, weekday } = useLocale()
  const { extra, dismissed, dismissNeeded, restoreNeeded } = useApp()

  const all = useMemo(() => likelyNeededSoon(extra), [extra])
  const visible = all.filter((f) => !dismissed.includes(f.product.id))
  const hidden = all.filter((f) => dismissed.includes(f.product.id))

  const comparison = fixtures.routeComparisons[0]
  const currentMerchant = getMerchant(comparison.currentMerchantId)
  const altMerchant = getMerchant(comparison.alternativeMerchantId)

  const proactive = fixtures.recommendations.find((r) => r.kind === 'proactive')
  const predicted = useMemo(
    () =>
      proactive?.predictedBasket && proactive.routeComparisonId
        ? compareBasket(proactive.routeComparisonId, proactive.predictedBasket)
        : null,
    [proactive],
  )

  return (
    <Page title={t('needed.title')} subtitle={t('needed.subtitle')} back>
      {visible.length === 0 && hidden.length === 0 ? (
        <EmptyState icon={<IconCheck size={26} />} title={t('needed.empty')} />
      ) : (
        <div className="card card-pad">
          {visible.map((f) => (
            <div key={f.product.id} className={styles.need}>
              <span className={styles.needMain}>
                <span className={styles.needName}>
                  {L(f.product.name)}
                  <span className={styles.lineUnit}> · {L(f.product.unit)}</span>
                </span>
                <span className={styles.needMeta}>
                  {t('needed.every', { n: number(Math.round(f.meanIntervalDays)) })}
                  {' · '}
                  {t('needed.lastBought', { n: number(f.daysSinceLast) })}
                </span>
              </span>
              <span className={`badge ${f.ratio >= 1 ? 'badge-alert' : 'badge-soon'}`}>
                {f.ratio >= 1 ? t('needed.overdue') : t('needed.due')}
              </span>
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => dismissNeeded(f.product.id)}
                aria-label={`${t('needed.dismissed')}: ${L(f.product.name)}`}
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}

          {hidden.map((f) => (
            <div key={f.product.id} className={styles.need} style={{ opacity: 0.55 }}>
              <span className={styles.needMain}>
                <span className={styles.needName} style={{ textDecoration: 'line-through' }}>
                  {L(f.product.name)}
                </span>
                <span className={styles.needMeta}>{t('needed.dismissed')}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => restoreNeeded(f.product.id)}
              >
                {t('common.undo')}
              </button>
            </div>
          ))}
        </div>
      )}

      {predicted && proactive?.predictedWeekday !== undefined && (
        <Section title={t('foryou.proactiveTitle', { weekday: weekday(proactive.predictedWeekday) })}>
          <div className="card card-pad">
            <div className={styles.ledgerRow}>
              <span className={styles.ledgerLabel}>{L(currentMerchant?.name)}</span>
              <span className="num">{money(predicted.current.total)}</span>
            </div>
            <div className={styles.ledgerRow}>
              <span className={styles.ledgerLabel}>{L(altMerchant?.name)}</span>
              <span className="num gain">{money(predicted.alternative.total)}</span>
            </div>
            <div className={styles.ledgerRow} data-net="true">
              <span className={styles.ledgerLabel}>{t('compare.perBasket')}</span>
              <span className="num">{money(predicted.saving)}</span>
            </div>
          </div>
        </Section>
      )}

      <div style={{ marginBlockStart: 'var(--s-5)' }}>
        <Note>
          {t('common.estimated')}.{' '}
          {`${t('needed.due')} ≥ ${Math.round(DUE_RATIO * 100)}%`}
        </Note>
      </div>
    </Page>
  )
}
