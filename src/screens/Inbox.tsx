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

export function Inbox() {
  const { t, L, money, relativeDay, time } = useLocale()
  const { openCases, resolveCase, unresolveCase, lastResolved, dismissLastResolved, addPurchase } = useApp()

  const [resolving, setResolving] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [merchantQuery, setMerchantQuery] = useState('')
  const [receiptTotal, setReceiptTotal] = useState('')

  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const choose = (caseId: string, merchantId: string) => {
    setResolving(caseId)
    timer.current = window.setTimeout(() => {
      resolveCase(caseId, merchantId)
      setResolving(null)
    }, 420)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchantQuery || !receiptTotal) return

    addPurchase({
      merchantId: `mer_${Date.now()}`,
      flatTotal: parseFloat(receiptTotal) || 0,
      source: 'upload',
      items: [{ title: receiptUrl ? `קבלה: ${receiptUrl}` : 'קבלה פיזית', price: parseFloat(receiptTotal) || 0, qty: 1 }]
    })

    setReceiptUrl('')
    setMerchantQuery('')
    setReceiptTotal('')
    setShowAddModal(false)
  }

  const resolvedMerchant = lastResolved ? getMerchant(lastResolved.merchantId) : null

  return (
    <Page title={t('inbox.title')}>

      {/* כפתור הוספת קבלה / לינק חדש */}
      <div style={{ marginBlockEnd: 'var(--s-4)' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          + הוסף קבלה / לינק חדש
        </button>
      </div>

      {/* מודל / טופס הוספה */}
      {showAddModal && (
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBlockEnd: 'var(--s-5)' }}>
          <h3 style={{ marginBlockEnd: '12px', fontSize: '16px', fontWeight: 'bold' }}>העלאת קבלה או לינק (Pairzon)</h3>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="הדבק לינק קבלה (למשל https://public.pairzon.com/...)"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text"
              placeholder="מאיפה בוצעה הקנייה? (למשל: אושר עד סניף בני ברק)"
              value={merchantQuery}
              onChange={(e) => setMerchantQuery(e.target.value)}
              required
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="number"
              placeholder="סכום כולל בשקלים (למשל 150)"
              value={receiptTotal}
              onChange={(e) => setReceiptTotal(e.target.value)}
              required
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginBlockStart: '6px' }}>
              <button type="submit" className="btn btn-primary">שמור והוסף לתיבה</button>
              <button type="button" className="btn btn-quiet" onClick={() => setShowAddModal(false)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

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

      {openCases.length === 0 && !showAddModal && (
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