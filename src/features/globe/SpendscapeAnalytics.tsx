import { useEffect } from 'react'
import type { ChangeEvent } from 'react'
import type { PurchaseAnalytics } from '@/data/spendscape-analytics'
import type { AnalyticsView } from '@/features/ask/ask-spendscape-domain'
import {
  localized,
  placeForId,
  type CategoryFilter,
  type ChannelFilter,
  type CurrencyFilter,
  type LocaleCode,
  type PurchaseCategory,
  type PurchaseQuery,
} from '@/data/spendscape-globe'
import styles from './SpendscapeAnalytics.module.css'

interface SpendscapeAnalyticsProps {
  analytics: PurchaseAnalytics
  locale: LocaleCode
  query: PurchaseQuery
  activeFilterCount: number
  onClose: () => void
  onSearch: (value: string) => void
  onOpenFilters: () => void
  onOpenTimeline: () => void
  onReset: () => void
  onOpenPurchases: () => void
  onSelectCategory: (category: CategoryFilter) => void
  onSelectChannel: (channel: ChannelFilter) => void
  onSelectCurrency: (currency: CurrencyFilter) => void
  onSelectMonth: (month: string | null) => void
  onSelectPlace: (placeId: string) => void
  initialView: AnalyticsView | null
}

const copy = {
  en: {
    eyebrow: 'Deterministic analytics · synthetic data',
    title: 'Spend, with the world still in view.',
    intro: 'Every value is recalculated from the same filtered purchase graph as the globe and history.',
    close: 'Close analytics', search: 'Search analytics and purchases', filters: 'Filters', timeline: 'Timeline',
    reset: 'Reset shared view', viewPurchases: 'View matching purchases', results: 'matching purchases',
    total: 'Illustrative base spend', purchases: 'Purchases', average: 'Average purchase',
    normalizedNote: 'Normalized values use explicit fixed synthetic fixture rates to ILS—not factual FX.',
    timeTitle: 'Spend over time', timeBody: 'Choose a month to update Analytics, Globe, Timeline, and Purchases together.',
    monthClear: 'All months', selected: 'Selected', channelTitle: 'Where it happened',
    channelBody: 'Physical, online, and unresolved records reconcile to the current result set.',
    physical: 'Physical', online: 'Online', unresolved: 'Unresolved',
    categoryTitle: 'Category shape', categoryBody: 'Amount and count stay visible, so color is never the only signal.',
    groceries: 'Groceries', food: 'Food', retail: 'Retail', travel: 'Travel',
    placesTitle: 'Top physical places', placesBody: 'Repeated purchases aggregate into one canonical place.',
    openGlobe: 'Open on globe', visits: 'purchases', noPlaces: 'No physical places in this view.',
    provenanceTitle: 'Currency and source provenance',
    provenanceBody: 'Original amounts remain grouped in their source currency; only the secondary ILS view is normalized.',
    original: 'original', base: 'illustrative ILS', fixedRate: 'fixed synthetic rate',
    evidenceTitle: 'Evidence mix',
    cardRecord: 'Card record', receipt: 'Receipt', emailReceipt: 'Email receipt', manualEntry: 'Manual entry',
    emptyTitle: 'No analytics for this shared view',
    emptyBody: 'Adjust the search, filters, or selected month. The canonical fixtures remain unchanged.',
  },
  he: {
    eyebrow: 'ניתוחים דטרמיניסטיים · נתונים סינתטיים',
    title: 'ההוצאות, כשהעולם עדיין מולך.',
    intro: 'כל ערך מחושב מחדש מאותו גרף רכישות מסונן שמזין את הגלובוס ואת ההיסטוריה.',
    close: 'סגירת ניתוחים', search: 'חיפוש בניתוחים וברכישות', filters: 'מסננים', timeline: 'ציר זמן',
    reset: 'איפוס התצוגה המשותפת', viewPurchases: 'הצגת הרכישות התואמות', results: 'רכישות תואמות',
    total: 'הוצאה בסיסית להמחשה', purchases: 'רכישות', average: 'רכישה ממוצעת',
    normalizedNote: 'הערכים המנורמלים משתמשים בשערי fixture סינתטיים וקבועים לש״ח — לא בשערי מט״ח עובדתיים.',
    timeTitle: 'הוצאות לאורך זמן', timeBody: 'בחירת חודש מעדכנת יחד את הניתוחים, הגלובוס, ציר הזמן והרכישות.',
    monthClear: 'כל החודשים', selected: 'נבחר', channelTitle: 'איפה זה קרה',
    channelBody: 'רשומות פיזיות, אונליין ולא פתורות מסתכמות בדיוק לתוצאות הנוכחיות.',
    physical: 'פיזי', online: 'אונליין', unresolved: 'לא פתור',
    categoryTitle: 'מבנה הקטגוריות', categoryBody: 'הסכום והכמות תמיד מוצגים, כך שהצבע אינו האות היחיד.',
    groceries: 'מכולת', food: 'אוכל', retail: 'קמעונאות', travel: 'נסיעות',
    placesTitle: 'מקומות פיזיים מובילים', placesBody: 'רכישות חוזרות מתאחדות למקום קנוני יחיד.',
    openGlobe: 'פתיחה בגלובוס', visits: 'רכישות', noPlaces: 'אין מקומות פיזיים בתצוגה זו.',
    provenanceTitle: 'מקור מטבע וראיות',
    provenanceBody: 'הסכומים המקוריים נשארים מקובצים במטבע המקור; רק תצוגת הש״ח המשנית מנורמלת.',
    original: 'מקורי', base: 'ש״ח להמחשה', fixedRate: 'שער סינתטי קבוע',
    evidenceTitle: 'תמהיל ראיות',
    cardRecord: 'רשומת כרטיס', receipt: 'קבלה', emailReceipt: 'קבלה בדוא״ל', manualEntry: 'הזנה ידנית',
    emptyTitle: 'אין נתונים לניתוח בתצוגה המשותפת',
    emptyBody: 'אפשר לשנות חיפוש, מסננים או חודש נבחר. ה־fixtures הקנוניים נשארים ללא שינוי.',
  },
} as const

const categoryLabels: Record<PurchaseCategory, keyof typeof copy.en> = {
  groceries: 'groceries', food: 'food', retail: 'retail', travel: 'travel',
}

const channelLabels = {
  physical: 'physical', online: 'online', unresolved: 'unresolved',
} as const

const evidenceLabels = {
  'card-record': 'cardRecord', receipt: 'receipt',
  'email-receipt': 'emailReceipt', 'manual-entry': 'manualEntry',
} as const

function formatMoney(amount: number, locale: LocaleCode, currency = 'ILS'): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}

function formatMonth(month: string, locale: LocaleCode, short = false): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric', timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`))
}

function percentage(value: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'percent', maximumFractionDigits: 0,
  }).format(value)
}

function chartGeometry(months: PurchaseAnalytics['months']) {
  const width = 640
  const height = 178
  const insetX = 16
  const insetY = 16
  const maximum = Math.max(...months.map((month) => month.totalBaseAmountIls), 1)
  const usableWidth = width - insetX * 2
  const usableHeight = height - insetY * 2
  const points = months.map((month, index) => ({
    ...month,
    x: months.length === 1 ? width / 2 : insetX + index / (months.length - 1) * usableWidth,
    y: height - insetY - month.totalBaseAmountIls / maximum * usableHeight,
  }))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const area = points.length === 0
    ? ''
    : `${line} L ${points[points.length - 1].x} ${height - insetY} L ${points[0].x} ${height - insetY} Z`
  return { width, height, maximum, points, line, area }
}

export function SpendscapeAnalytics({
  analytics, locale, query, activeFilterCount, onClose, onSearch, onOpenFilters,
  onOpenTimeline, onReset, onOpenPurchases, onSelectCategory, onSelectChannel,
  onSelectCurrency, onSelectMonth, onSelectPlace, initialView,
}: SpendscapeAnalyticsProps) {
  const t = copy[locale]
  const chart = chartGeometry(analytics.months)
  const hasActiveQuery = Boolean(
    query.search || query.category !== 'all' || query.currency !== 'all' ||
    query.channel !== 'all' || query.dateRange !== 'all' || query.timelineMonth,
  )

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => onSearch(event.target.value)

  useEffect(() => {
    if (!initialView) return
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-analytics-view="${initialView}"]`)
      target?.scrollIntoView({ block: 'start', behavior: 'auto' })
      target?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialView])

  return (
    <section className={styles.panel} aria-labelledby="analytics-title" data-testid="analytics-panel">
      <header className={styles.header}>
        <div>
          <p>{t.eyebrow}</p>
          <h2 id="analytics-title">{t.title}</h2>
          <span>{t.intro}</span>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div className={styles.sharedControls}>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <span className={styles.srOnly}>{t.search}</span>
          <input
            type="search"
            value={query.search}
            onChange={handleSearch}
            placeholder={t.search}
            aria-label={t.search}
            data-testid="analytics-search"
          />
        </label>
        <button type="button" onClick={onOpenFilters} data-testid="analytics-filters">
          <i className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg></i>
          <span>{t.filters}</span>{activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
        </button>
        <button type="button" onClick={onOpenTimeline} data-testid="analytics-timeline">
          <i className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h9M5 17h5" /><circle cx="18" cy="16" r="3" /></svg></i>
          <span>{t.timeline}</span>
        </button>
        {hasActiveQuery && <button type="button" onClick={onReset} data-testid="analytics-reset">
          <i className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 9a7 7 0 1 1-1 5M5 4v5h5" /></svg></i>
          <span>{t.reset}</span>
        </button>}
      </div>

      <div className={styles.scrollArea}>
        <section className={styles.heroMetrics} aria-label={t.title} data-testid="analytics-summary" data-analytics-view="overview" tabIndex={-1}>
          <article className={styles.totalMetric}>
            <span>{t.total}</span>
            <strong data-testid="analytics-total">{formatMoney(analytics.totalBaseAmountIls, locale)}</strong>
            <small>{t.normalizedNote}</small>
          </article>
          <article>
            <span>{t.purchases}</span>
            <strong data-testid="analytics-count">{analytics.purchaseCount}</strong>
            <small>{t.results}</small>
          </article>
          <article>
            <span>{t.average}</span>
            <strong data-testid="analytics-average">{formatMoney(analytics.averageBaseAmountIls, locale)}</strong>
            <small>{t.base}</small>
          </article>
        </section>

        {analytics.purchaseCount === 0 ? (
          <section className={styles.empty} role="status" data-testid="analytics-empty">
            <span aria-hidden="true">0</span>
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyBody}</p>
            <button type="button" onClick={onReset}>{t.reset}</button>
          </section>
        ) : (
          <>
            <section className={`${styles.card} ${styles.timelineCard}`} aria-labelledby="analytics-time-title" data-analytics-view="timeline" tabIndex={-1}>
              <div className={styles.sectionHeading}>
                <div><h3 id="analytics-time-title">{t.timeTitle}</h3><p>{t.timeBody}</p></div>
                {query.timelineMonth && (
                  <button type="button" onClick={() => onSelectMonth(null)}>{t.monthClear}</button>
                )}
              </div>
              <svg
                className={styles.timeChart}
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-labelledby="analytics-time-chart-title analytics-time-chart-description"
              >
                <title id="analytics-time-chart-title">{t.timeTitle}</title>
                <desc id="analytics-time-chart-description">
                  {analytics.months.map((month) => `${formatMonth(month.month, locale)}: ${formatMoney(month.totalBaseAmountIls, locale)}`).join('; ')}
                </desc>
                <path className={styles.gridLine} d={`M 16 16 H 624 M 16 89 H 624 M 16 162 H 624`} />
                <path className={styles.chartArea} d={chart.area} />
                <path className={styles.chartLine} d={chart.line} />
                {chart.points.map((point) => (
                  <circle
                    key={point.month}
                    className={styles.chartPoint}
                    data-selected={query.timelineMonth === point.month}
                    cx={point.x}
                    cy={point.y}
                    r={query.timelineMonth === point.month ? 6 : 3.5}
                  />
                ))}
              </svg>
              <div className={styles.monthSelectors} aria-label={t.timeTitle}>
                {analytics.months.map((month) => (
                  <button
                    type="button"
                    key={month.month}
                    aria-pressed={query.timelineMonth === month.month}
                    onClick={() => onSelectMonth(query.timelineMonth === month.month ? null : month.month)}
                    data-testid={`analytics-month-${month.month}`}
                  >
                    <span className={styles.monthBar} aria-hidden="true"><i style={{ blockSize: `${Math.max(8, month.totalBaseAmountIls / chart.maximum * 100)}%` }} /></span>
                    <strong>{formatMonth(month.month, locale, true)}</strong>
                    <small>{formatMoney(month.totalBaseAmountIls, locale)}</small>
                  </button>
                ))}
              </div>
            </section>

            <div className={styles.twoColumn}>
              <section className={styles.card} aria-labelledby="analytics-channel-title" data-analytics-view="channels" tabIndex={-1}>
                <div className={styles.sectionHeading}>
                  <div><h3 id="analytics-channel-title">{t.channelTitle}</h3><p>{t.channelBody}</p></div>
                </div>
                <div className={styles.channelList}>
                  {analytics.channels.map((channel) => (
                    <button
                      type="button"
                      key={channel.key}
                      data-channel={channel.key}
                      aria-pressed={query.channel === channel.key}
                      onClick={() => onSelectChannel(query.channel === channel.key ? 'all' : channel.key)}
                      data-testid={`analytics-channel-${channel.key}`}
                    >
                      <span><i aria-hidden="true" /><strong>{t[channelLabels[channel.key]]}</strong></span>
                      <b>{channel.purchaseCount}</b>
                      <small>{formatMoney(channel.totalBaseAmountIls, locale)} · {percentage(channel.shareOfSpend, locale)}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.card} aria-labelledby="analytics-category-title" data-analytics-view="categories" tabIndex={-1}>
                <div className={styles.sectionHeading}>
                  <div><h3 id="analytics-category-title">{t.categoryTitle}</h3><p>{t.categoryBody}</p></div>
                </div>
                <div className={styles.categoryList}>
                  {analytics.categories.map((category) => (
                    <button
                      type="button"
                      key={category.key}
                      data-category={category.key}
                      aria-pressed={query.category === category.key}
                      onClick={() => onSelectCategory(query.category === category.key ? 'all' : category.key)}
                      data-testid={`analytics-category-${category.key}`}
                    >
                      <span><strong>{t[categoryLabels[category.key]]}</strong><small>{category.purchaseCount} {t.purchases}</small></span>
                      <span className={styles.categoryTrack} aria-hidden="true"><i style={{ inlineSize: `${category.shareOfSpend * 100}%` }} /></span>
                      <b>{formatMoney(category.totalBaseAmountIls, locale)}</b>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className={styles.card} aria-labelledby="analytics-places-title" data-analytics-view="places" tabIndex={-1}>
              <div className={styles.sectionHeading}>
                <div><h3 id="analytics-places-title">{t.placesTitle}</h3><p>{t.placesBody}</p></div>
              </div>
              {analytics.topPhysicalPlaces.length === 0 ? <p className={styles.noPlaces}>{t.noPlaces}</p> : (
                <ol className={styles.placeList}>
                  {analytics.topPhysicalPlaces.slice(0, 5).map((placeAnalytics, index) => {
                    const place = placeForId(placeAnalytics.placeId)
                    if (!place) return null
                    return (
                      <li key={placeAnalytics.placeId}>
                        <button type="button" onClick={() => onSelectPlace(placeAnalytics.placeId)} data-testid={`analytics-place-${placeAnalytics.placeId}`}>
                          <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                          <span className={styles.placeIdentity}>
                            <strong>{localized(place.name, locale)}</strong>
                            <small>{localized(place.branch, locale)} · {localized(place.city, locale)}</small>
                          </span>
                          <span className={styles.placeAmount}>
                            <strong>{formatMoney(placeAnalytics.totalBaseAmountIls, locale)}</strong>
                            <small>{placeAnalytics.purchaseCount} {t.visits}</small>
                          </span>
                          <span className={styles.openPlace}>{t.openGlobe}<i aria-hidden="true">↗</i></span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className={styles.card} aria-labelledby="analytics-provenance-title" data-analytics-view="currencies" tabIndex={-1}>
              <div className={styles.sectionHeading}>
                <div><h3 id="analytics-provenance-title">{t.provenanceTitle}</h3><p>{t.provenanceBody}</p></div>
              </div>
              <div className={styles.provenanceGrid}>
                <div className={styles.currencyList}>
                  {analytics.currencies.map((currency) => (
                    <button
                      type="button"
                      key={currency.currency}
                      aria-pressed={query.currency === currency.currency}
                      onClick={() => onSelectCurrency(query.currency === currency.currency ? 'all' : currency.currency)}
                      data-testid={`analytics-currency-${currency.currency}`}
                    >
                      <strong>{currency.currency}</strong>
                      <span>{formatMoney(currency.originalAmountTotal, locale, currency.currency)} <small>{t.original}</small></span>
                      <span>{formatMoney(currency.totalBaseAmountIls, locale)} <small>{t.base}</small></span>
                      <em>{t.fixedRate} · {currency.syntheticRatesToBase.join(', ')}</em>
                    </button>
                  ))}
                </div>
                <div className={styles.evidenceList}>
                  <h4>{t.evidenceTitle}</h4>
                  {analytics.evidenceSources.map((source) => (
                    <div key={source.key}>
                      <span><strong>{t[evidenceLabels[source.key]]}</strong><small>{source.purchaseCount} {t.purchases}</small></span>
                      <b>{formatMoney(source.totalBaseAmountIls, locale)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <footer className={styles.footer}>
        <span><strong>{analytics.purchaseCount}</strong> {t.results}</span>
        <button type="button" onClick={onOpenPurchases} data-testid="analytics-view-purchases">{t.viewPurchases}<i aria-hidden="true">→</i></button>
      </footer>
    </section>
  )
}
