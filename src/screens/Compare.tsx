import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { compare, getProduct } from '@/data/derive'
import { MapSurface } from '@/map/MapSurface'
import { useMapCamera } from '@/map/useMapCamera'
import { fitBounds, type LonLat } from '@/map/projection'
import { Page } from '@/components/AppShell'
import { EmptyState, Note, Section } from '@/components/ui'
import { categoryColor } from '@/components/categories'
import { IconCar, IconCheck, IconClose, IconPin } from '@/components/Icons'
import styles from './detail.module.css'

/**
 * The route-aware comparison.
 *
 * This screen carries the product's actual argument, so it has to survive
 * scrutiny: it shows one alternative rather than the cheapest of everything, it
 * subtracts the cost of the extra driving instead of quoting a gross figure,
 * and it names the substitution it refused to make.
 */
export function Compare() {
  const { id } = useParams<{ id: string }>()
  const { t, L, money, number } = useLocale()
  const { extra } = useApp()

  const result = useMemo(() => (id ? compare(id, extra) : null), [id, extra])

  const initialView = useMemo(() => {
    if (!result) return { center: [34.78, 32.08] as LonLat, zoom: 13 }
    return fitBounds(
      [
        result.comparison.originCoord,
        result.current.merchant.coord,
        result.alternative.merchant.coord,
      ],
      { width: 360, height: 200 },
      56,
    )
  }, [result])

  const camera = useMapCamera(initialView)

  if (!result) {
    return (
      <Page title={t('compare.title')} back>
        <EmptyState icon={<IconPin size={26} />} title={t('map.emptyFilter')} />
      </Page>
    )
  }

  const { comparison, current, alternative } = result

  return (
    <Page title={t('compare.title')} back>
      {/* ---- Route schematic ---- */}
      <div className={styles.miniMap} style={{ blockSize: 200 }}>
        <MapSurface view={camera.view} onViewChange={camera.setView}>
          {({ project, size }) => {
            const line = (path: LonLat[]) =>
              path
                .map((c, i) => {
                  const p = project(c)
                  return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
                })
                .join(' ')

            const origin = project(comparison.originCoord)
            const cur = project(current.merchant.coord)
            const alt = project(alternative.merchant.coord)

            return (
              <>
                <svg
                  width={size.width}
                  height={size.height}
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                  aria-hidden="true"
                >
                  <path
                    d={line(comparison.currentLeg.path)}
                    stroke="var(--ink-400)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="1 7"
                    fill="none"
                  />
                  <path
                    d={line(comparison.alternativeLeg.path)}
                    stroke="var(--gain-500)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>

                <span
                  className={styles.miniPin}
                  style={{
                    insetInlineStart: origin.x,
                    insetBlockStart: origin.y,
                    background: 'var(--ink-700)',
                    inlineSize: 12,
                    blockSize: 12,
                  }}
                />
                <span
                  className={styles.miniPin}
                  style={{
                    insetInlineStart: cur.x,
                    insetBlockStart: cur.y,
                    background: categoryColor(current.merchant.category),
                  }}
                />
                <span
                  className={styles.miniPin}
                  style={{
                    insetInlineStart: alt.x,
                    insetBlockStart: alt.y,
                    background: 'var(--gain-500)',
                  }}
                />
              </>
            )
          }}
        </MapSurface>
      </div>

      {/* ---- The two baskets ---- */}
      <div className={styles.versus} style={{ marginBlockStart: 'var(--s-4)' }}>
        <div className={styles.side}>
          <span className={`kicker ${styles.sideLabel}`}>{t('compare.yourStore')}</span>
          <span className={styles.sideName}>{L(current.merchant.name)}</span>
          <span className={`${styles.sideAmount} num`}>{money(current.basket.total)}</span>
          <span className={styles.sideDrive}>
            <IconCar size={15} />
            {t('compare.drive', {
              km: number(comparison.currentLeg.distanceKm, 1),
              min: comparison.currentLeg.durationMin,
            })}
          </span>
        </div>

        <div className={styles.side} data-winner="true">
          <span className={`kicker ${styles.sideLabel}`}>{t('compare.alternative')}</span>
          <span className={styles.sideName}>{L(alternative.merchant.name)}</span>
          <span className={`${styles.sideAmount} num gain`}>{money(alternative.basket.total)}</span>
          <span className={styles.sideDrive}>
            <IconCar size={15} />
            {t('compare.drive', {
              km: number(comparison.alternativeLeg.distanceKm, 1),
              min: comparison.alternativeLeg.durationMin,
            })}
          </span>
        </div>
      </div>

      {/* ---- What it actually amounts to ---- */}
      <Section title={t('compare.net')}>
        <div className="card card-pad">
          <div className={styles.ledger}>
            <div className={styles.ledgerRow}>
              <span className={styles.ledgerLabel}>{t('compare.perBasket')}</span>
              <span className="num">{money(result.perBasketSaving)}</span>
            </div>
            <div className={styles.ledgerRow}>
              <span className={styles.ledgerLabel}>{t('compare.perMonthGross')}</span>
              <span className="num">{money(result.grossMonthlySaving)}</span>
            </div>
            <div className={styles.ledgerRow}>
              <span className={styles.ledgerLabel}>{t('compare.transport')}</span>
              <span className="num">−{money(result.monthlyTransportCost)}</span>
            </div>
            <div className={styles.ledgerRow} data-net="true">
              <span className={styles.ledgerLabel}>{t('compare.net')}</span>
              <span className="num">
                {money(result.netMonthlySaving)}{t('common.perMonth')}
              </span>
            </div>
          </div>

          <p className="caption" style={{ marginBlockStart: 'var(--s-3)' }}>
            {t('compare.frequency', { n: number(result.basketsPerMonth, 1) })}
            {' '}
            {t('compare.addedTime', { min: result.addedTravelMin })}.
          </p>
        </div>
      </Section>

      {/* ---- Where the difference comes from ---- */}
      <Section title={t('compare.itemsTitle')}>
        <div className="card card-pad">
          {result.itemDeltas
            .filter((d) => Math.abs(d.delta) >= 0.01)
            .map((d) => (
              <div key={d.product.id} className={styles.delta}>
                <span className={styles.deltaName}>
                  {L(d.product.name)}
                  <span className={styles.lineUnit}> · {L(d.product.unit)}</span>
                </span>
                <span className="caption num">
                  {money(d.currentUnit)} → {money(d.altUnit)}
                </span>
                <span className="num gain" style={{ fontWeight: 620, minInlineSize: 62, textAlign: 'end' }}>
                  {money(d.delta)}
                </span>
              </div>
            ))}
        </div>
      </Section>

      {/* ---- The equivalence rules, made visible ---- */}
      <Section title={t('compare.equivTitle')}>
        <div className="card card-pad">
          {comparison.substitutions.map((sub) => {
            const from = getProduct(sub.fromProductId)
            const to = getProduct(sub.toProductId)
            if (!from || !to) return null
            return (
              <div key={`${sub.fromProductId}-${sub.toProductId}`} className={styles.equiv}>
                <span
                  className={`badge ${sub.accepted ? 'badge-gain' : 'badge-alert'} ${styles.equivBadge}`}
                >
                  {sub.accepted ? <IconCheck size={12} /> : <IconClose size={12} />}
                  {sub.accepted ? t('compare.accepted') : t('compare.refused')}
                </span>
                <span className={styles.equivMain}>
                  <span className={styles.equivSwap}>
                    {L(from.name)} → {L(to.name)}
                  </span>
                  <span className={styles.equivReason}>{L(sub.reason)}</span>
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      <div className="stack stack-3" style={{ marginBlockStart: 'var(--s-5)' }}>
        <Note>{t('compare.oneStore')}</Note>
        <Note>{t('compare.routeNote')} {t('common.estimated')}.</Note>
      </div>
    </Page>
  )
}
