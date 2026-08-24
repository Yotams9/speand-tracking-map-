import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import {
  categoryTrends, compare, compareBasket, daysBetween, habitFor, likelyNeededSoon,
  merchantStats,
} from '@/data/derive'
import { fixtures } from '@/data/fixtures'
import { Page } from '@/components/AppShell'
import { InsightCard, Note } from '@/components/ui'
import { categoryLabelKey } from '@/components/categories'
import { IconClock, IconRepeat, IconTrend } from '@/components/Icons'
import styles from './ForYou.module.css'

/**
 * For You holds decision-oriented insights only.
 *
 * The discipline here is subtractive: a card earns its place by changing what
 * someone might do. Anything that only restates what they already know belongs
 * in history, not here.
 */
export function ForYou() {
  const { t, L, money, number, weekday } = useLocale()
  const { extra, dismissed } = useApp()

  const result = useMemo(() => compare('rc_01', extra), [extra])
  const habit = useMemo(() => habitFor('m_nomi_tlv', extra), [extra])
  const trend = useMemo(() => categoryTrends(30, extra)[0], [extra])

  const proactive = fixtures.recommendations.find((r) => r.kind === 'proactive')
  const predicted = useMemo(
    () =>
      proactive?.predictedBasket && proactive.routeComparisonId
        ? compareBasket(proactive.routeComparisonId, proactive.predictedBasket)
        : null,
    [proactive],
  )

  const due = useMemo(
    () => likelyNeededSoon(extra).filter((f) => !dismissed.includes(f.product.id)),
    [extra, dismissed],
  )

  // How much history the prediction actually rests on.
  const weeksOfHistory = useMemo(() => {
    const stats = merchantStats('m_shuk', extra)
    if (!stats?.firstVisit || !stats.lastVisit) return 0
    return Math.max(1, Math.round(daysBetween(stats.firstVisit, stats.lastVisit) / 7))
  }, [extra])

  return (
    <Page title={t('foryou.title')} subtitle={t('foryou.subtitle')}>
      <div className={styles.grid}>
        {/* ---- The reactive recurring saving ---- */}
        {result && result.perBasketSaving > 0 && (
          <InsightCard
            kicker={t('foryou.savingKicker')}
            icon={<IconRepeat size={17} />}
            tint="var(--gain-500)"
            figure={`${money(result.netMonthlySaving, { decimals: false })}${t('common.perMonth')}`}
            title={t('foryou.savingTitle')}
            body={t('foryou.savingBody', {
              alt: L(result.alternative.merchant.name),
              saving: money(result.perBasketSaving),
              min: result.addedTravelMin,
            })}
            cta={t('foryou.savingCta')}
            to={`/compare/${result.comparison.id}`}
          >
            <span className="badge badge-demo" style={{ marginBlockStart: 'var(--s-3)' }}>
              {t('common.estimated')}
            </span>
          </InsightCard>
        )}

        {/* ---- The proactive one ---- */}
        {predicted && proactive?.predictedWeekday !== undefined && (
          <InsightCard
            kicker={t('foryou.proactiveKicker')}
            icon={<IconClock size={17} />}
            tint="var(--brand-500)"
            title={t('foryou.proactiveTitle', { weekday: weekday(proactive.predictedWeekday) })}
            body={t('foryou.proactiveBody', {
              n: weeksOfHistory,
              saving: money(predicted.saving),
              alt: L(result?.alternative.merchant.name ?? { en: '', he: '' }),
            })}
            cta={t('foryou.proactiveCta')}
            to="/needed"
          />
        )}

        {/* ---- Likely needed soon ---- */}
        {due.length > 0 && (
          <InsightCard
            kicker={t('foryou.neededKicker')}
            icon={<IconRepeat size={17} />}
            tint="var(--cat-shopping)"
            title={t('needed.title')}
            body={t('foryou.neededBody', { n: due.length })}
            cta={t('common.viewAll')}
            to="/needed"
          >
            <ul className={styles.pills}>
              {due.slice(0, 4).map((f) => (
                <li key={f.product.id} className={styles.pill}>{L(f.product.name)}</li>
              ))}
            </ul>
          </InsightCard>
        )}

        {/* ---- A habit, stated plainly ---- */}
        {habit && (
          <InsightCard
            kicker={t('foryou.habitKicker')}
            icon={<IconClock size={17} />}
            tint="var(--cat-food)"
            title={L(habit.merchant.name)}
            body={t('foryou.habitBody', {
              merchant: L(habit.merchant.name),
              visits: habit.visits,
              weekday: weekday(habit.dominantWeekday),
            })}
            cta={t('map.seePlace')}
            to={`/merchant/${habit.merchant.id}`}
          />
        )}

        {/* ---- A trend, only when there is a real one ---- */}
        {trend && Math.abs(trend.changePct) >= 10 && (
          <InsightCard
            kicker={t('foryou.trendKicker')}
            icon={<IconTrend size={17} />}
            tint="var(--cat-fuel)"
            title={`${t(categoryLabelKey(trend.category))} · ${money(trend.recentTotal, { decimals: false })}`}
            body={t('foryou.trendBody', {
              category: t(categoryLabelKey(trend.category)),
              direction: trend.changePct > 0 ? t('foryou.trendUp') : t('foryou.trendDown'),
              pct: number(Math.abs(Math.round(trend.changePct))),
            })}
          />
        )}
      </div>

      <div style={{ marginBlockStart: 'var(--s-5)' }}>
        <Note>{t('demo.explain')}</Note>
      </div>

      <p className={styles.footLink}>
        <Link to="/profile">{t('profile.history')}</Link>
      </p>
    </Page>
  )
}
