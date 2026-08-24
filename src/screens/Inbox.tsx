import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { fixtures } from '@/data/fixtures'
import { getMerchant, totalOf } from '@/data/derive'
import { Page } from '@/components/AppShell'
import { EmptyState } from '@/components/ui'
import { categoryColor } from '@/components/categories'
import { IconCheck, IconClose } from '@/components/Icons'
import styles from './Inbox.module.css'

/**
 * Smart Inbox.
 *
 * The design constraint is restraint. This screen may only hold cases where an
 * answer changes an outcome, it must resolve in one tap, and its normal state
 * is empty. A task list would be a failure of the product, not a feature of it.
 */
export function Inbox() {
  const { t, L, money, relativeDay, time } = useLocale()
  const { openCases, resolveCase, unresolveCase, lastResolved, dismissLastResolved } = useApp()

  const [resolving, setResolving] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const choose = (caseId: string, merchantId: string) => {
    setResolving(caseId)
    // A short beat so the change of state is perceivable rather than a flicker.
    timer.current = window.setTimeout(() => {
      resolveCase(caseId, merchantId)
      setResolving(null)
    }, 420)
  }

  const resolvedMerchant = lastResolved ? getMerchant(lastResolved.merchantId) : null

  return (
    <Page title={t('inbox.title')}>
      {lastResolved && resolvedMerchant && (
        <div className={styles.resolved} role="status">
          <IconCheck size={20} />
          <span className={styles.resolvedText}>
            {t('inbox.resolved', { merchant: L(resolvedMerchant.name) })}
          </span>
          <button
            type="button"
            className={styles.undo}
            onClick={() => unresolveCase(lastResolved.caseId)}
          >
            {t('common.undo')}
          </button>
          <button
            type="button"
            className={styles.dismissResolved}
            onClick={dismissLastResolved}
            aria-label={t('common.close')}
          >
            <IconClose size={16} />
          </button>
        </div>
      )}

      {openCases.length === 0 && (
        <div style={{ marginBlockStart: lastResolved ? 'var(--s-5)' : 0 }}>
          <EmptyState
            icon={<IconCheck size={26} />}
            title={t('inbox.allClear')}
            body={t('inbox.allClearBody')}
          />
        </div>
      )}

      <div className="stack stack-4">
        {openCases.map((kase) => {
          const purchase = fixtures.purchases.find((p) => p.id === kase.purchaseId)
          if (!purchase) return null
          const busy = resolving === kase.id

          return (
            <div key={kase.id} className={styles.case}>
              <div className={styles.caseTop}>
                <span className="kicker">{t('inbox.oneThing')}</span>
                <span className={`${styles.amount} num`} style={{ marginBlockStart: 6 }}>
                  {money(totalOf(purchase))}
                </span>
                <p className={styles.meta}>
                  {relativeDay(purchase.timestamp)} · {time(purchase.timestamp)} · {L(kase.areaLabel)}
                </p>
              </div>

              {busy ? (
                <div className={styles.resolvingRow} role="status" aria-live="polite">
                  <span className={styles.miniSpinner} />
                  {t('inbox.resolving')}
                </div>
              ) : (
                <div className={styles.question}>
                  <p className={styles.questionText}>{t('inbox.question')}</p>

                  <div className={styles.choices}>
                    {kase.candidateMerchantIds.map((id) => {
                      const merchant = getMerchant(id)
                      if (!merchant) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className={styles.choice}
                          onClick={() => choose(kase.id, id)}
                          disabled={busy}
                        >
                          <span
                            className={styles.choiceDot}
                            style={{ background: categoryColor(merchant.category) }}
                            aria-hidden="true"
                          />
                          <span className={styles.choiceText}>
                            {L(merchant.name)}
                            {merchant.branch && (
                              <span className={styles.choiceSub}>{L(merchant.branch)}</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* The reasoning is available, but it is not the default view.
                      Ordinary use should never require reading it. */}
                  <details className={styles.why}>
                    <summary className={styles.whySummary}>{t('inbox.whyAsking')}</summary>
                    <p className={styles.whyBody}>{t('inbox.whyBody')}</p>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </Page>
  )
}
