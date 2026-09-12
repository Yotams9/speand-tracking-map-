import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { useApp } from '@/state/AppState'
import exifr from 'exifr'
import {
  IconArrowBack, IconGlobe, IconInbox, IconMap, IconPerson, IconPlus, IconSpark,
} from './Icons'
import styles from './AppShell.module.css'

export function AppShell() {
  const { t } = useLocale()
  const { openCases } = useApp()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const fill = pathname === '/'

  const tabs = [
    { to: '/', label: t('nav.map'), Icon: IconMap, end: true },
    { to: '/for-you', label: t('nav.forYou'), Icon: IconSpark, end: false },
    { to: '/capture', label: t('nav.capture'), Icon: IconPlus, end: false, capture: true },
    { to: '/inbox', label: t('nav.inbox'), Icon: IconInbox, end: false, badge: openCases.length > 0 },
    { to: '/profile', label: t('nav.profile'), Icon: IconPerson, end: false },
  ]

  const handleCameraChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const gpsData = await exifr.gps(file)
      if (gpsData?.latitude && gpsData?.longitude) {
        const usePhoto = window.confirm("נמצא מיקום מדויק בתמונה! האם להשתמש בו?")
        if (usePhoto) {
          const name = window.prompt("הכנס שם לקנייה:", "קנייה מתמונה") || "הוצאה חדשה"
          alert(`"${name}" נוספה במיקום: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`)
          navigate('/')
          return
        }
      }
      askAlternatives()
    } catch (error) {
      askAlternatives()
    }
    event.target.value = ''
  }

  const askAlternatives = () => {
    const useGPS = window.confirm("לא זוהה מיקום. האם להשתמש במיקום ה-GPS הנוכחי שלך?")
    if (useGPS) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const name = window.prompt("הכנס שם לקנייה:", "מיקום נוכחי") || "הוצאה חדשה"
        alert(`"${name}" נוספה במיקום: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
        navigate('/')
      }, () => {
        alert("לא הצלחנו לאתר את מיקומך. מעביר למפה לבחירה ידנית.")
        navigate('/')
      })
    } else {
      alert("מעביר למפה לבחירה ידנית.")
      navigate('/')
    }
  }

  return (
    <div className={styles.wrap}>

      {/* אינפוט נסתר של המצלמה */}
      <input
        id="hidden-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCameraChange}
      />

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
            capture ? (
              <button
                key="capture-btn"
                className={`${styles.tab} ${styles.captureTab}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('hidden-camera-input')?.click()
                }}
              >
                <span className={styles.captureButton}><Icon size={24} /></span>
                <span className={styles.captureSpacer} aria-hidden="true" />
                <span className={styles.tabLabel}>{label}</span>
              </button>
            ) : (
              <NavLink key={to} to={to} end={end} className={styles.tab}>
                <span className={styles.tabIconWrap}>
                  <Icon size={22} />
                  {badge && <span className={styles.dot} aria-hidden="true" />}
                </span>
                <span className={styles.tabLabel}>{label}</span>
              </NavLink>
            )
          ))}
        </nav>
      </div>
    </div>
  )
}

export function Page({ title, subtitle, back, action, children }: any) {
  const navigate = useNavigate()
  const { t } = useLocale()

  return (
    <div className={styles.page}>
      {(title || back) && (
        <header className={styles.header}>
          {back && (
            <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label={t('common.back')}>
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