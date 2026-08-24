import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { fixtures } from '@/data/fixtures'
import { depositForBasket, getProduct, priceOf, round2 } from '@/data/derive'
import { Page } from '@/components/AppShell'
import { Note } from '@/components/ui'
import {
  IconBarcode, IconCamera, IconCheck, IconClose, IconPencil, IconProducts,
  IconReceipt, IconUpload,
} from '@/components/Icons'
import type { BasketEntry, CaptureSource } from '@/data/types'
import styles from './Capture.module.css'

type Mode = 'idle' | 'processing' | 'review' | 'quickAdd' | 'success' | 'failed'

interface Draft {
  merchantId: string
  items: BasketEntry[]
  source: CaptureSource
}

/** What each simulated path "recognises". Drawn from the fixtures, never invented. */
const SIMULATED: Record<string, Draft> = {
  receipt: {
    merchantId: 'm_shuk',
    source: 'receipt_photo',
    items: [
      { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 },
      { productId: 'p_eggs', qty: 1 }, { productId: 'p_tomato', qty: 1 },
      { productId: 'p_yogurt', qty: 4 }, { productId: 'p_cola', qty: 2 },
    ],
  },
  products: {
    merchantId: 'm_shuk',
    source: 'product_photo',
    items: [
      { productId: 'p_milk', qty: 1 }, { productId: 'p_coffee', qty: 1 },
      { productId: 'p_pasta', qty: 2 },
    ],
  },
  barcode: {
    merchantId: 'm_shuk',
    source: 'barcode',
    items: [{ productId: 'p_milk', qty: 1 }],
  },
  upload: {
    merchantId: 'm_rimon',
    source: 'digital_receipt',
    items: [
      { productId: 'p_milk_alt', qty: 2 }, { productId: 'p_bread', qty: 1 },
      { productId: 'p_coffee', qty: 1 },
    ],
  },
}

/**
 * Capture, simulated.
 *
 * The screen has a job beyond logging a purchase: it has to make clear that
 * this is the exception, not the routine. Hence the panel at the bottom — most
 * purchases should arrive without anyone opening this screen at all.
 */
export function Capture() {
  const { t, L, money } = useLocale()
  const { addPurchase } = useApp()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [processingLabel, setProcessingLabel] = useState('')
  const [addedId, setAddedId] = useState<string | null>(null)
  const [uploadAttempted, setUploadAttempted] = useState(false)

  // Quick add
  const [qaMerchant, setQaMerchant] = useState('')
  const [qaAmount, setQaAmount] = useState('')
  const [qaTouched, setQaTouched] = useState(false)

  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const runSimulation = (key: keyof typeof SIMULATED, label: string) => {
    setProcessingLabel(label)
    setMode('processing')

    timer.current = window.setTimeout(() => {
      // The upload path fails the first time, on purpose: a demo that only ever
      // shows the happy path says nothing about how the product recovers.
      if (key === 'upload' && !uploadAttempted) {
        setUploadAttempted(true)
        setMode('failed')
        return
      }
      setDraft(SIMULATED[key])
      setMode('review')
    }, 1200)
  }

  const draftTotal = draft
    ? round2(
        draft.items.reduce((sum, entry) => {
          const price = priceOf(draft.merchantId, entry.productId) ?? 0
          return sum + price * entry.qty
        }, 0) + depositForBasket(draft.items),
      )
    : 0

  const confirmDraft = () => {
    if (!draft) return
    const purchase = addPurchase({
      merchantId: draft.merchantId,
      items: draft.items,
      source: draft.source,
    })
    setAddedId(purchase.id)
    setMode('success')
  }

  const amountValue = Number.parseFloat(qaAmount)
  const amountInvalid = qaTouched && (!Number.isFinite(amountValue) || amountValue <= 0)
  const merchantInvalid = qaTouched && qaMerchant === ''

  const submitQuickAdd = () => {
    setQaTouched(true)
    if (!Number.isFinite(amountValue) || amountValue <= 0 || qaMerchant === '') return
    const purchase = addPurchase({
      merchantId: qaMerchant,
      items: [],
      flatTotal: round2(amountValue),
      source: 'quick_add',
    })
    setAddedId(purchase.id)
    setMode('success')
  }

  const reset = () => {
    setMode('idle')
    setDraft(null)
    setAddedId(null)
    setQaMerchant('')
    setQaAmount('')
    setQaTouched(false)
  }

  // -- Processing ------------------------------------------------------------

  if (mode === 'processing') {
    return (
      <Page title={t('capture.title')}>
        <div className={styles.stage} role="status" aria-live="polite">
          <span className={styles.spinner} />
          <p className="heading">{processingLabel}</p>
          <p className="sub">{t('capture.simulated')}</p>
        </div>
      </Page>
    )
  }

  // -- Simulated failure -----------------------------------------------------

  if (mode === 'failed') {
    return (
      <Page title={t('capture.title')}>
        <div className={styles.stage} role="alert">
          <span className={styles.failMark}><IconClose size={28} /></span>
          <div>
            <p className="title">{t('capture.uploadFail')}</p>
            <p className="sub" style={{ marginBlockStart: 6 }}>{t('capture.uploadFailBody')}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn btn-quiet" onClick={reset}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => runSimulation('upload', t('capture.processingUpload'))}
            >
              {t('capture.retry')}
            </button>
          </div>
        </div>
      </Page>
    )
  }

  // -- Review ----------------------------------------------------------------

  if (mode === 'review' && draft) {
    const merchant = fixtures.merchants.find((m) => m.id === draft.merchantId)!
    return (
      <Page title={t('capture.reviewTitle')} back>
        <div className="card card-pad">
          <p className="kicker">{L(merchant.name)}</p>
          <div className={styles.reviewLines} style={{ marginBlockStart: 'var(--s-3)' }}>
            {draft.items.map((entry) => {
              const product = getProduct(entry.productId)!
              const price = priceOf(draft.merchantId, entry.productId) ?? 0
              return (
                <div key={entry.productId} className={styles.reviewLine}>
                  <span>
                    {L(product.name)}
                    <span className="caption"> · {L(product.unit)} × {entry.qty}</span>
                  </span>
                  <span className="num">{money(round2(price * entry.qty))}</span>
                </div>
              )
            })}
          </div>
          <div className={styles.reviewTotal}>
            <span>{t('purchase.total')}</span>
            <span className="num">{money(draftTotal)}</span>
          </div>
        </div>

        <p className="caption" style={{ marginBlock: 'var(--s-3)' }}>{t('capture.reviewHint')}</p>

        <div className={styles.actions}>
          <button type="button" className="btn btn-quiet" onClick={reset}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={confirmDraft}>
            {t('capture.confirm')}
          </button>
        </div>
      </Page>
    )
  }

  // -- Success ---------------------------------------------------------------

  if (mode === 'success') {
    return (
      <Page title={t('capture.title')}>
        <div className={styles.stage} role="status" aria-live="polite">
          <span className={styles.successMark}><IconCheck size={28} /></span>
          <div>
            <p className="title">{t('capture.added')}</p>
            <p className="sub" style={{ marginBlockStart: 6 }}>{t('capture.addedBody')}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn btn-quiet" onClick={reset}>
              {t('common.done')}
            </button>
            {addedId && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/purchase/${addedId}`)}
              >
                {t('capture.seeIt')}
              </button>
            )}
          </div>
        </div>
      </Page>
    )
  }

  // -- Quick add -------------------------------------------------------------

  if (mode === 'quickAdd') {
    return (
      <Page title={t('capture.quickAdd')} back>
        <div className="card card-pad stack stack-4">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="qa-store">{t('capture.qaStore')}</label>
            <select
              id="qa-store"
              className={styles.select}
              value={qaMerchant}
              onChange={(e) => setQaMerchant(e.target.value)}
              aria-invalid={merchantInvalid}
            >
              <option value="">{t('capture.qaStorePlaceholder')}</option>
              {fixtures.merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {L(m.name)}{m.branch ? ` · ${L(m.branch)}` : ''}
                </option>
              ))}
            </select>
            {merchantInvalid && <span className={styles.error}>{t('capture.errStore')}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="qa-amount">{t('capture.qaAmount')}</label>
            <input
              id="qa-amount"
              className={styles.input}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={qaAmount}
              onChange={(e) => setQaAmount(e.target.value)}
              aria-invalid={amountInvalid}
            />
            {amountInvalid && <span className={styles.error}>{t('capture.errAmount')}</span>}
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn btn-quiet" onClick={reset}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={submitQuickAdd}>
              {t('capture.confirm')}
            </button>
          </div>
        </div>
      </Page>
    )
  }

  // -- Idle ------------------------------------------------------------------

  return (
    <Page title={t('capture.title')}>
      <div className={styles.wrap}>
        <div className={styles.finder}>
          <div className={styles.finderBrackets} aria-hidden="true">
            <span className={styles.bracket} />
            <span className={styles.bracket} />
            <span className={styles.bracket} />
            <span className={styles.bracket} />
          </div>
          <span className={styles.scanline} aria-hidden="true" />
          <div className={styles.finderText}>
            <IconCamera size={30} />
            <p>{t('capture.viewfinderHint')}</p>
            <span className={styles.finderBadge}>{t('capture.simulated')}</span>
          </div>
        </div>

        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            onClick={() => runSimulation('receipt', t('capture.processing'))}
          >
            <span className={styles.optionIcon}><IconReceipt size={19} /></span>
            {t('capture.scanReceipt')}
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => runSimulation('products', t('capture.processingProducts'))}
          >
            <span className={styles.optionIcon}><IconProducts size={19} /></span>
            {t('capture.scanProducts')}
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => runSimulation('barcode', t('capture.processingBarcode'))}
          >
            <span className={styles.optionIcon}><IconBarcode size={19} /></span>
            {t('capture.scanBarcode')}
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => runSimulation('upload', t('capture.processingUpload'))}
          >
            <span className={styles.optionIcon}><IconUpload size={19} /></span>
            {t('capture.upload')}
          </button>

          <button type="button" className={styles.option} onClick={() => setMode('quickAdd')}>
            <span className={styles.optionIcon}><IconPencil size={19} /></span>
            {t('capture.quickAdd')}
          </button>
        </div>

        <div className="card card-pad">
          <h2 className="heading">{t('capture.autoTitle')}</h2>
          <p className="sub" style={{ marginBlockStart: 6 }}>{t('capture.autoBody')}</p>
        </div>

        <Note>{t('demo.explain')}</Note>
      </div>
    </Page>
  )
}
