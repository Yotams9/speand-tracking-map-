import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale, type Lang } from '@/i18n'
import { useApp } from '@/state/AppState'
import {
  categoryTotals, historyRange, merchantStats, resolvedPurchases, totalSpend,
} from '@/data/derive'
import { fixtures } from '@/data/fixtures'
import { Page } from '@/components/AppShell'
import { DeferredRow, Note, PurchaseRow, Section, Stats } from '@/components/ui'
import { categoryColor, categoryLabelKey } from '@/components/categories'
import { IconChevron, IconGlobe } from '@/components/Icons'
import styles from './detail.module.css'

const HISTORY_PAGE = 8

export function Profile() {
  const { t, L, money, number, date, plural, lang, setLang } = useLocale()
  const { extra } = useApp()
  const [shown, setShown] = useState(HISTORY_PAGE)

  const purchases = useMemo(() => resolvedPurchases(extra), [extra])
  const spendAll = useMemo(() => totalSpend(extra), [extra])
  const cats = useMemo(() => categoryTotals(extra), [extra])
  const range = useMemo(() => historyRange(extra), [extra])

  const visited = useMemo(
    () =>
      fixtures.merchants
        .map((m) => merchantStats(m.id, extra))
        .filter((s): s is NonNullable<typeof s> => s !== null && s.visits > 0)
        .sort((a, b) => b.visits - a.visits),
    [extra],
  )

  // The headline counts every place visited; the list below shows only the top
  // few. Reading the count off the truncated list would understate it.
  const frequent = visited.slice(0, 4)

  const maxCat = Math.max(1, ...cats.map((c) => c.total))

  return (
    <Page
      title={t('profile.title')}
      subtitle={
        range
          ? `${L(fixtures.user.homeAreaLabel)} · ${t('profile.since', { from: date(range.from) })}`
          : L(fixtures.user.homeAreaLabel)
      }
    >
      <div className={styles.twoCol}>
        <div>
          <Stats
            items={[
              { label: t('profile.spentAll'), value: money(spendAll, { decimals: false }) },
              { label: t('map.purchases'), value: number(purchases.length) },
              { label: t('map.places'), value: number(visited.length) },
            ]}
          />

          <Section title={t('profile.categories')}>
            <div className="card card-pad">
              {cats.map((c) => (
                <div key={c.category} className={styles.catRow}>
                  <span className={styles.catName}>{t(categoryLabelKey(c.category))}</span>
                  <span className={styles.catTrack}>
                    <span
                      className={styles.catFill}
                      style={{
                        inlineSize: `${(c.total / maxCat) * 100}%`,
                        background: categoryColor(c.category),
                      }}
                    />
                  </span>
                  <span className={`${styles.catAmount} num`}>
                    {money(c.total, { decimals: false })}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('profile.frequent')}>
            <div className="card card-pad">
              {frequent.map((s) => (
                <Link key={s.merchant.id} to={`/merchant/${s.merchant.id}`} className="row">
                  <span
                    className="chip-dot"
                    style={{ color: categoryColor(s.merchant.category) }}
                    aria-hidden="true"
                  />
                  <span className="row-grow">
                    <span className="truncate" style={{ fontWeight: 580, display: 'block' }}>
                      {L(s.merchant.name)}
                    </span>
                    <span className="caption">
                      {plural(s.visits, 'common.visit', 'common.visits')}
                      {' · '}{money(s.totalSpend, { decimals: false })}
                    </span>
                  </span>
                  <IconChevron size={18} className="chevron" />
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div>
          <Section title={t('profile.history')}>
            <div className="card card-pad">
              {purchases.slice(0, shown).map((p) => (
                <PurchaseRow key={p.id} purchase={p} />
              ))}
              {shown < purchases.length && (
                <button
                  type="button"
                  className="btn btn-quiet btn-block"
                  style={{ marginBlockStart: 'var(--s-3)' }}
                  onClick={() => setShown((n) => n + HISTORY_PAGE)}
                >
                  {t('common.viewAll')} ({number(purchases.length - shown)})
                </button>
              )}
            </div>
          </Section>

          <Section title={t('profile.preferences')}>
            <div className="card card-pad">
              <div className="row">
                <IconGlobe size={18} />
                <span className="row-grow">{t('profile.language')}</span>
                <div className="cluster" role="group" aria-label={t('profile.language')}>
                  {(['en', 'he'] as Lang[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="chip"
                      aria-pressed={lang === code}
                      onClick={() => setLang(code)}
                    >
                      {code === 'en' ? 'English' : 'עברית'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('profile.privacy')}>
            <div className="card card-pad stack stack-3">
              <div>
                <p className="heading">{t('profile.locationUse')}</p>
                <p className="sub" style={{ marginBlockStart: 4 }}>{t('profile.locationBody')}</p>
              </div>
              <div>
                <p className="heading">{t('profile.dataUse')}</p>
                <p className="sub" style={{ marginBlockStart: 4 }}>{t('profile.dataBody')}</p>
              </div>
            </div>
          </Section>

          <Section title={t('profile.integrations')}>
            <div className="card card-pad">
              <p className="sub" style={{ marginBlockEnd: 'var(--s-2)' }}>
                {t('profile.integrationsBody')}
              </p>
              <DeferredRow title={t('profile.bank')} />
              <DeferredRow title={t('profile.email')} />
              <DeferredRow title={t('profile.sms')} />
            </div>
          </Section>

          <div style={{ marginBlockStart: 'var(--s-4)' }}>
            <Note>{t('demo.explain')}</Note>
          </div>
        </div>
      </div>
    </Page>
  )
}
