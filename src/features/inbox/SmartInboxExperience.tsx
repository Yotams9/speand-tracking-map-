'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  localized,
  merchantForId,
  placeForId,
  purchasesForPlace,
  type GlobePurchase,
  type LocaleCode,
  type SmartInboxCase,
} from '@/data/spendscape-globe'
import type { SmartInboxDecision } from './smart-inbox-domain'
import styles from './SmartInboxExperience.module.css'

interface SmartInboxExperienceProps {
  locale: LocaleCode
  inboxCase: SmartInboxCase
  purchase: GlobePurchase
  purchases: readonly GlobePurchase[]
  decision?: SmartInboxDecision
  onClose: () => void
  onConfirm: (decision: SmartInboxDecision) => void
  onUndo: () => void
  onOpenPurchase: (purchaseId: string) => void
  onShowPlace: (placeId: string) => void
}

const copy = {
  en: {
    close: 'Close Smart Inbox', eyebrow: 'Smart Inbox · material uncertainty', title: 'One choice needs you',
    body: 'Spendscape asks only because this decision changes your place history.', synthetic: 'Synthetic case',
    recorded: 'Recorded facts', amount: 'Amount', date: 'Date', source: 'Source', sourceValue: 'Manual entry',
    choices: 'Choose one', priorVisits: 'prior visits', noRecommendation: 'No candidate is preselected or recommended.',
    none: 'None / not sure', noneBody: 'Keep this purchase unresolved and off the globe.',
    review: 'Review your choice', reviewBody: 'Nothing changes until you confirm.',
    confirmPlace: 'Confirm place', confirmNone: 'Leave unresolved', selectFirst: 'Select an option to continue',
    complete: 'Inbox is up to date', resolvedBody: 'The purchase now belongs to this existing place. Its history changed; no duplicate pin was created.',
    deferredBody: 'The purchase stays unresolved and creates no pin.', undo: 'Undo decision',
    viewPurchase: 'View purchase', showPlace: 'Show place', reload: 'This demo decision resets on reload.',
  },
  he: {
    close: 'סגירת תיבת העזרה', eyebrow: 'תיבת עזרה חכמה · אי־ודאות מהותית', title: 'בחירה אחת זקוקה לך',
    body: 'Spendscape שואלת רק מפני שההחלטה הזו משנה את היסטוריית המקומות שלך.', synthetic: 'מקרה סינתטי',
    recorded: 'עובדות שנרשמו', amount: 'סכום', date: 'תאריך', source: 'מקור', sourceValue: 'הזנה ידנית',
    choices: 'בחרו אפשרות אחת', priorVisits: 'ביקורים קודמים', noRecommendation: 'אף מועמד אינו מסומן מראש או מומלץ.',
    none: 'אף אחד / לא בטוח', noneBody: 'השאירו את הרכישה לא פתורה ומחוץ לגלובוס.',
    review: 'בדיקת הבחירה', reviewBody: 'דבר לא ישתנה עד לאישור.',
    confirmPlace: 'אישור המקום', confirmNone: 'השארה כלא פתור', selectFirst: 'יש לבחור אפשרות כדי להמשיך',
    complete: 'תיבת העזרה מעודכנת', resolvedBody: 'הרכישה משויכת כעת למקום הקיים. ההיסטוריה השתנתה ולא נוצרה סיכה כפולה.',
    deferredBody: 'הרכישה נשארת לא פתורה ואינה יוצרת סיכה.', undo: 'ביטול ההחלטה',
    viewPurchase: 'הצגת הרכישה', showPlace: 'הצגת המקום', reload: 'החלטת ההדגמה מתאפסת בטעינה מחדש.',
  },
} as const

function formatAmount(purchase: GlobePurchase, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency', currency: purchase.originalCurrency, maximumFractionDigits: 2,
  }).format(purchase.originalAmount)
}

function formatDate(timestamp: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
}

export function SmartInboxExperience({
  locale,
  inboxCase,
  purchase,
  purchases,
  decision,
  onClose,
  onConfirm,
  onUndo,
  onOpenPurchase,
  onShowPlace,
}: SmartInboxExperienceProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | 'defer' | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const t = copy[locale]

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null)
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      previousFocusRef.current?.focus({ preventScroll: true })
    }
  }, [])

  const selectedPlace = selectedChoice && selectedChoice !== 'defer' ? placeForId(selectedChoice) : undefined
  const resolvedPlace = decision?.status === 'resolved' ? placeForId(decision.placeId) : undefined
  const candidateRows = useMemo(() => inboxCase.candidates.map((candidate) => {
    const place = placeForId(candidate.placeId)
    if (!place) return null
    return {
      candidate,
      place,
      merchant: merchantForId(place.merchantId),
      visitCount: purchasesForPlace(place.id, purchases).length,
    }
  }).filter((row): row is NonNullable<typeof row> => row !== null), [inboxCase.candidates, purchases])

  const confirm = () => {
    if (!selectedChoice) return
    onConfirm(selectedChoice === 'defer'
      ? { caseId: inboxCase.id, status: 'deferred' }
      : { caseId: inboxCase.id, status: 'resolved', placeId: selectedChoice })
  }

  return (
    <div className={styles.layer} data-testid="smart-inbox-layer">
      <button type="button" className={styles.scrim} onClick={onClose} aria-label={t.close} />
      <aside ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="smart-inbox-title">
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <span className={styles.inboxMark} aria-hidden="true"><i /></span>
            <div><p>{t.eyebrow}</p><strong>{t.synthetic}</strong></div>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={t.close}>×</button>
        </header>

        {decision ? (
          <div className={styles.complete} data-testid="smart-inbox-complete" role="status">
            <span className={styles.completeMark} aria-hidden="true">✓</span>
            <p className={styles.kicker}>{t.complete}</p>
            <h2 id="smart-inbox-title">{resolvedPlace ? localized(resolvedPlace.name, locale) : t.none}</h2>
            <p>{resolvedPlace ? t.resolvedBody : t.deferredBody}</p>
            {resolvedPlace && (
              <div className={styles.resolvedPlace}>
                <span>{localized(resolvedPlace.branch, locale)}</span>
                <strong>{localized(resolvedPlace.city, locale)}</strong>
              </div>
            )}
            <div className={styles.completeActions}>
              <button type="button" className={styles.primary} onClick={() => onOpenPurchase(purchase.id)}>{t.viewPurchase}</button>
              {resolvedPlace && <button type="button" className={styles.secondary} onClick={() => onShowPlace(resolvedPlace.id)}>{t.showPlace}</button>}
              <button type="button" className={styles.undo} onClick={onUndo} data-testid="smart-inbox-undo">{t.undo}</button>
            </div>
            <small>{t.reload}</small>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.intro}>
              <p className={styles.kicker}>{t.title}</p>
              <h2 id="smart-inbox-title">{localized(inboxCase.question, locale)}</h2>
              <p>{localized(inboxCase.rationale, locale)}</p>
              <small>{t.body}</small>
            </div>

            <section className={styles.facts} aria-labelledby="recorded-facts-title">
              <h3 id="recorded-facts-title">{t.recorded}</h3>
              <dl>
                <div><dt>{t.amount}</dt><dd>{formatAmount(purchase, locale)}</dd></div>
                <div><dt>{t.date}</dt><dd>{formatDate(purchase.timestamp, locale)}</dd></div>
                <div><dt>{t.source}</dt><dd>{t.sourceValue}</dd></div>
              </dl>
            </section>

            <fieldset className={styles.choices}>
              <legend>{t.choices}</legend>
              <p>{t.noRecommendation}</p>
              <div className={styles.choiceGrid}>
                {candidateRows.map(({ candidate, place, merchant, visitCount }) => (
                  <label key={place.id} className={styles.choice} data-selected={selectedChoice === place.id}>
                    <input type="radio" name="smart-inbox-choice" value={place.id} checked={selectedChoice === place.id} onChange={() => setSelectedChoice(place.id)} />
                    <span className={styles.choicePin} data-category={place.category} aria-hidden="true" />
                    <span>
                      <strong>{merchant ? localized(merchant.name, locale) : localized(place.name, locale)}</strong>
                      <small>{localized(place.branch, locale)} · {localized(place.city, locale)}</small>
                      <em>{visitCount} {t.priorVisits} · {localized(candidate.context, locale)}</em>
                    </span>
                    <i aria-hidden="true" />
                  </label>
                ))}
                <label className={`${styles.choice} ${styles.deferChoice}`} data-selected={selectedChoice === 'defer'}>
                  <input type="radio" name="smart-inbox-choice" value="defer" checked={selectedChoice === 'defer'} onChange={() => setSelectedChoice('defer')} />
                  <span className={styles.deferMark} aria-hidden="true">?</span>
                  <span><strong>{t.none}</strong><small>{t.noneBody}</small></span>
                  <i aria-hidden="true" />
                </label>
              </div>
            </fieldset>

            <footer className={styles.reviewBar} data-ready={Boolean(selectedChoice)}>
              <div><strong>{t.review}</strong><small>{selectedPlace ? `${localized(selectedPlace.branch, locale)} · ${localized(selectedPlace.city, locale)}` : selectedChoice === 'defer' ? t.noneBody : t.reviewBody}</small></div>
              <button type="button" className={styles.primary} disabled={!selectedChoice} onClick={confirm} data-testid="smart-inbox-confirm">
                {selectedChoice === 'defer' ? t.confirmNone : selectedChoice ? t.confirmPlace : t.selectFirst}
              </button>
            </footer>
          </div>
        )}
      </aside>
    </div>
  )
}
