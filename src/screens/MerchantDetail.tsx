import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import { compare, merchantStats, purchasesForMerchant } from '@/data/derive'
import { Page } from '@/components/AppShell'
import { EmptyState, PurchaseRow, Section, Stats } from '@/components/ui'
import { IconChevron, IconPin } from '@/components/Icons'
import styles from './detail.module.css'

export function MerchantDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, L, money, number } = useLocale()
  const { extra } = useApp()

  const stats = useMemo(() => (id ? merchantStats(id, extra) : null), [id, extra])
  const purchases = useMemo(() => (id ? purchasesForMerchant(id, extra) : []), [id, extra])
  const comparison = useMemo(() => compare('rc_01', extra), [extra])

  if (!stats) {
    return (
      <Page title={t('merchant.title')} back>
        <EmptyState icon={<IconPin size={26} />} title={t('map.emptyFilter')} />
      </Page>
    )
  }

  const showSaving =
    comparison !== null &&
    stats.merchant.id === comparison.comparison.currentMerchantId &&
    comparison.netMonthlySaving > 0

  const maxTimes = Math.max(1, ...stats.frequentProducts.map((f) => f.timesBought))

  return (
    <Page
      title={L(stats.merchant.name)}
      subtitle={[stats.merchant.branch ? L(stats.merchant.branch) : null, L(stats.merchant.address)]
        .filter(Boolean)
        .join(' · ')}
      back
    >
      <div className={styles.twoCol}>
        <div>
          <Stats
            items={[
              { label: t('merchant.visits'), value: number(stats.visits) },
              { label: t('merchant.spend'), value: money(stats.totalSpend, { decimals: false }) },
              { label: t('merchant.avg'), value: money(stats.avgPurchase, { decimals: false }) },
            ]}
          />

          {stats.meanIntervalDays !== null && (
            <p className="caption" style={{ marginBlockStart: 'var(--s-3)' }}>
              {t('merchant.every', { n: number(Math.round(stats.meanIntervalDays)) })}
            </p>
          )}

          {showSaving && comparison && (
            <Link
              to={`/compare/${comparison.comparison.id}`}
              className={styles.insightStrip}
              style={{ marginBlockStart: 'var(--s-4)' }}
            >
              <span className={styles.insightMain}>
                <span className={`${styles.insightAmount} num`}>
                  {t('merchant.savingBanner', {
                    amount: money(comparison.netMonthlySaving, { decimals: false }),
                  })}
                </span>
                <span className={styles.insightSub}>
                  {t('merchant.savingBannerBody', {
                    alt: L(comparison.alternative.merchant.name),
                  })}
                </span>
              </span>
              <IconChevron size={18} className="chevron" />
            </Link>
          )}

          {stats.frequentProducts.length > 0 && (
            <Section title={t('merchant.frequent')}>
              <div className="card card-pad">
                {stats.frequentProducts.slice(0, 6).map((f) => (
                  <div key={f.product.id} className={styles.freq}>
                    <span className={styles.freqName}>
                      {L(f.product.name)}
                      <span className={styles.lineUnit}> · {L(f.product.unit)}</span>
                    </span>
                    <span
                      className={styles.freqBar}
                      style={{ inlineSize: `${(f.timesBought / maxTimes) * 72}px` }}
                      aria-hidden="true"
                    />
                    <span className="caption num">
                      {t('merchant.times', { n: number(f.timesBought) })}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div>
          <Section title={`${t('merchant.history')} · ${number(purchases.length)}`}>
            <div className="card card-pad">
              {purchases.map((p) => (
                <PurchaseRow key={p.id} purchase={p} />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </Page>
  )
}
