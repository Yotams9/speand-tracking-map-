import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { fixtures } from '@/data/fixtures'
import {
  compare, getMerchant, linesOf, subtotalOf, totalOf,
} from '@/data/derive'
import { MapSurface } from '@/map/MapSurface'
import { useMapCamera } from '@/map/useMapCamera'
import { Page } from '@/components/AppShell'
import { EmptyState, Note, Section } from '@/components/ui'
import { categoryColor } from '@/components/categories'
import { IconChevron, IconInfo, IconReceipt } from '@/components/Icons'
import type { StringKey } from '@/i18n/strings'
import styles from './detail.module.css'

export function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, L, money, date, time } = useLocale()
  const { extra } = useApp()

  const purchase = useMemo(
    () => [...fixtures.purchases, ...extra].find((p) => p.id === id),
    [id, extra],
  )

  const merchant = purchase?.merchantId ? getMerchant(purchase.merchantId) : undefined
  const comparison = useMemo(() => compare('rc_01', extra), [extra])

  const camera = useMapCamera({
    center: merchant?.coord ?? [34.78, 32.08],
    zoom: 14.6,
  })

  if (!purchase || !merchant) {
    return (
      <Page title={t('purchase.title')} back>
        <EmptyState
          icon={<IconReceipt size={26} />}
          title={t('purchase.noItems')}
          action={
            <button type="button" className="btn btn-quiet" onClick={() => navigate('/')}>
              {t('nav.map')}
            </button>
          }
        />
      </Page>
    )
  }

  const lines = linesOf(purchase)
  const hasItems = lines.length > 0

  // The savings insight belongs here only when this purchase is the kind the
  // comparison actually covers. Attaching it to a coffee would be noise.
  const showInsight =
    comparison !== null &&
    merchant.id === comparison.comparison.currentMerchantId &&
    comparison.perBasketSaving > 0

  return (
    <Page title={t('purchase.title')} back>
      <div className={styles.twoCol}>
        <div>
          <div className={styles.hero}>
            <span className="kicker">{L(merchant.name)}{merchant.branch ? ` · ${L(merchant.branch)}` : ''}</span>
            <span className={`${styles.heroAmount} num`} style={{ marginBlockStart: 6 }}>
              {money(totalOf(purchase))}
            </span>
            <p className={styles.heroMeta}>
              {date(purchase.timestamp, { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{time(purchase.timestamp)}
            </p>
            <p className="caption" style={{ marginBlockStart: 4 }}>
              {L(merchant.address)} · {t('purchase.source')}: {t(`src.${purchase.captureSource}` as StringKey)}
            </p>
          </div>

          {showInsight && comparison && (
            <Link to={`/compare/${comparison.comparison.id}`} className={styles.insightStrip}>
              <span className={styles.insightMain}>
                <span className={`${styles.insightAmount} num`}>
                  {t('purchase.insight', { amount: money(comparison.perBasketSaving) })}
                </span>
                <span className={styles.insightSub}>
                  {t('purchase.insightBody', {
                    alt: L(comparison.alternative.merchant.name),
                    min: comparison.addedTravelMin,
                  })}
                </span>
              </span>
              <IconChevron size={18} className="chevron" />
            </Link>
          )}

          {!showInsight && (
            <div className={styles.quietStrip}>
              <IconInfo size={17} />
              <span>
                <strong style={{ display: 'block', color: 'var(--ink-700)' }}>
                  {t('purchase.noInsight')}
                </strong>
                <span className="caption">{t('purchase.noInsightBody')}</span>
              </span>
            </div>
          )}

          <Section title={t('purchase.items')}>
            {hasItems ? (
              <div className="card card-pad">
                <div className={styles.lines}>
                  {lines.map((line) => (
                    <div key={line.product.id} className={styles.line}>
                      <span className={styles.lineName}>
                        {L(line.product.name)}
                        <span className={styles.lineUnit}> · {L(line.product.unit)} × {line.qty}</span>
                      </span>
                      <span className="num">{money(line.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.totals}>
                  <div className={styles.totalRow}>
                    <span>{t('purchase.subtotal')}</span>
                    <span className="num">{money(subtotalOf(purchase))}</span>
                  </div>
                  {purchase.discount ? (
                    <div className={styles.totalRow}>
                      <span>{t('purchase.discount')}</span>
                      <span className="num">−{money(purchase.discount)}</span>
                    </div>
                  ) : null}
                  {purchase.deposit ? (
                    <div className={styles.totalRow}>
                      <span>{t('purchase.deposit')}</span>
                      <span className="num">{money(purchase.deposit)}</span>
                    </div>
                  ) : null}
                  <div className={styles.totalRow} data-grand="true">
                    <span>{t('purchase.total')}</span>
                    <span className="num">{money(totalOf(purchase))}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card card-pad">
                <p className="heading">{t('purchase.noItems')}</p>
                <p className="sub" style={{ marginBlockStart: 6 }}>{t('purchase.noItemsBody')}</p>
              </div>
            )}
          </Section>
        </div>

        <div>
          <Section title={t('merchant.title')}>
            <div className={styles.miniMap}>
              <MapSurface view={camera.view} onViewChange={camera.setView}>
                {({ project }) => {
                  const p = project(merchant.coord)
                  return (
                    <span
                      className={styles.miniPin}
                      style={{
                        insetInlineStart: p.x,
                        insetBlockStart: p.y,
                        background: categoryColor(merchant.category),
                      }}
                    />
                  )
                }}
              </MapSurface>
            </div>

            <Link
              to={`/merchant/${merchant.id}`}
              className="btn btn-quiet btn-block"
              style={{ marginBlockStart: 'var(--s-3)' }}
            >
              {t('map.seePlace')}
            </Link>
          </Section>

          <div style={{ marginBlockStart: 'var(--s-4)' }}>
            <Note>{t('demo.explain')}</Note>
          </div>
        </div>
      </div>
    </Page>
  )
}
