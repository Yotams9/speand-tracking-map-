import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import {
  IconArrowBack, IconGlobe, IconInbox, IconMap, IconPerson, IconPlus, IconSpark,
} from './Icons'
import styles from './AppShell.module.css'

/**
 * The frame every screen sits in.
 *
 * On phones the navigation is a bottom bar with Capture raised above it. On
 * desktop the same five destinations become a left rail — a different shape for
 * a different hand, not the phone layout stretched sideways.
 */
export function AppShell() {
  const { t } = useLocale()
  const { openCases } = useApp()
  const { pathname } = useLocation()

  // The map owns its own viewport; every other screen scrolls normally.
  const fill = pathname === '/'

  const tabs = [
    { to: '/', label: t('nav.map'), Icon: IconMap, end: true },
    { to: '/for-you', label: t('nav.forYou'), Icon: IconSpark, end: false },
    { to: '/capture', label: t('nav.capture'), Icon: IconPlus, end: false, capture: true },
    { to: '/inbox', label: t('nav.inbox'), Icon: IconInbox, end: false, badge: openCases.length > 0 },
    { to: '/profile', label: t('nav.profile'), Icon: IconPerson, end: false },
  ]

  return (
    <div className={styles.shell}>
      <main className={styles.main} data-fill={fill} id="main">
        <Outlet />
      </main>

      <nav className={styles.nav} aria-label={t('app.name')}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><IconGlobe size={18} /></span>
          <span>
            <span className="heading" style={{ display: 'block' }}>{t('app.name')}</span>
            <span className="caption">{t('demo.badge')}</span>
          </span>
        </div>

        {tabs.map(({ to, label, Icon, end, capture, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={capture ? `${styles.tab} ${styles.captureTab}` : styles.tab}
          >
            {capture ? (
              <>
                <span className={styles.captureButton}><Icon size={24} /></span>
                <span className={styles.captureSpacer} aria-hidden="true" />
                <span className={styles.tabLabel}>{label}</span>
              </>
            ) : (
              <>
                <span className={styles.tabIconWrap}>
                  <Icon size={22} />
                  {badge && <span className={styles.dot} aria-hidden="true" />}
                </span>
                <span className={styles.tabLabel}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Standard page wrapper for the scrolling screens. */
export function Page({
  title, subtitle, back, action, children,
}: {
  title?: string
  subtitle?: string
  back?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  const { t } = useLocale()

  return (
    <div className={styles.page}>
      {(title || back) && (
        <header className={styles.header}>
          {back && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => navigate(-1)}
              aria-label={t('common.back')}
            >
              <IconArrowBack />
            </button>
          )}
          <div className={styles.headerText}>
            {title && <h1 className="title">{title}</h1>}
            {subtitle && <p className="sub" style={{ marginBlockStart: 4 }}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </div>
  )
}
