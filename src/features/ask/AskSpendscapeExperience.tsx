import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { LocaleCode } from '@/data/spendscape-globe'
import {
  describeAskAction,
  parseAskCommand,
  type AskAction,
  type AskContext,
  type AskParseResult,
} from './ask-spendscape-domain'
import styles from './AskSpendscapeExperience.module.css'

interface AskSpendscapeExperienceProps {
  locale: LocaleCode
  context: AskContext
  onClose: () => void
  onExecute: (actions: AskAction[], summary: string) => void
}

const copy = {
  en: {
    eyebrow: 'Synthetic · local demo',
    title: 'Ask Spendscape',
    body: 'Move through your synthetic spend without changing any purchase facts.',
    close: 'Close Ask Spendscape',
    label: 'Type a safe map or interface command',
    placeholder: 'Try “Show my purchases in Tel Aviv”',
    run: 'Run',
    suggestions: 'Try a local action',
    preview: 'Review this two-step plan',
    apply: 'Apply plan',
    cancel: 'Cancel',
    choose: 'Choose one canonical place',
    boundary: 'No model, network, provider, or data mutation is used.',
  },
  he: {
    eyebrow: 'סינתטי · הדגמה מקומית',
    title: 'שאלו את Spendscape',
    body: 'ניווט בהוצאות הסינתטיות בלי לשנות עובדות על רכישות.',
    close: 'סגירת שאלו את Spendscape',
    label: 'הקלידו פקודת מפה או ממשק בטוחה',
    placeholder: 'למשל „הצג רכישות בתל אביב”',
    run: 'הפעלה',
    suggestions: 'אפשר לנסות פעולה מקומית',
    preview: 'בדיקת תוכנית בת שני שלבים',
    apply: 'החלת התוכנית',
    cancel: 'ביטול',
    choose: 'בחרו מקום קנוני אחד',
    boundary: 'ללא מודל, רשת, ספק או שינוי נתונים.',
  },
} as const

const suggestions = {
  en: ['Fly to Shuk Express', 'Show my purchases in Tel Aviv', 'Open analytics categories', 'Fit visible purchases'],
  he: ['טוס לשוק אקספרס', 'הצג רכישות בתל אביב', 'פתח ניתוחים קטגוריות', 'התאם את כל הרכישות'],
} as const

export function AskSpendscapeExperience({ locale, context, onClose, onExecute }: AskSpendscapeExperienceProps) {
  const t = copy[locale]
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [command, setCommand] = useState('')
  const [result, setResult] = useState<AskParseResult>({ kind: 'empty' })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // The host owns Escape/history dismissal. Handling it here as well would
      // traverse Back twice and can unmount the page before focus is restored.
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const evaluate = (value: string) => {
    const parsed = parseAskCommand(value, locale, context)
    setResult(parsed)
    if (parsed.kind === 'single') onExecute([parsed.action], parsed.summary)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    evaluate(command)
  }

  const chooseSuggestion = (value: string) => {
    setCommand(value)
    evaluate(value)
  }

  return (
    <div className={styles.layer} data-testid="ask-layer">
      <button type="button" className={styles.scrim} onClick={onClose} aria-label={t.close} />
      <section ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="ask-panel">
        <header>
          <div>
            <p>{t.eyebrow}</p>
            <h2 id={titleId}>{t.title}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <p className={styles.intro}>{t.body}</p>

        <form onSubmit={submit} className={styles.commandForm}>
          <label htmlFor={`${titleId}-command`}>{t.label}</label>
          <div>
            <span aria-hidden="true">✦</span>
            <input
              ref={inputRef}
              id={`${titleId}-command`}
              type="text"
              role="combobox"
              aria-expanded={result.kind === 'ambiguous'}
              aria-controls={`${titleId}-results`}
              value={command}
              onChange={(event) => {
                setCommand(event.target.value)
                if (result.kind !== 'empty') setResult({ kind: 'empty' })
              }}
              placeholder={t.placeholder}
              autoComplete="off"
              data-testid="ask-input"
            />
            <button type="submit" data-testid="ask-run">{t.run}</button>
          </div>
        </form>

        {result.kind === 'empty' && (
          <section className={styles.suggestions} aria-labelledby={`${titleId}-suggestions`}>
            <h3 id={`${titleId}-suggestions`}>{t.suggestions}</h3>
            <div>
              {suggestions[locale].map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => chooseSuggestion(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </section>
        )}

        <div id={`${titleId}-results`} className={styles.result} aria-live="polite">
          {result.kind === 'plan' && (
            <section className={styles.plan} data-testid="ask-plan-preview">
              <p>{t.preview}</p>
              <ol>
                {result.actions.map((action, index) => <li key={`${action.type}-${index}`}>{describeAskAction(action, locale)}</li>)}
              </ol>
              <div>
                <button type="button" className={styles.apply} onClick={() => onExecute(result.actions, result.summary)} data-testid="ask-apply-plan">{t.apply}</button>
                <button type="button" onClick={() => setResult({ kind: 'empty' })}>{t.cancel}</button>
              </div>
            </section>
          )}

          {result.kind === 'ambiguous' && (
            <section className={styles.ambiguous} data-testid="ask-ambiguous">
              <p>{t.choose}</p>
              <div role="listbox" aria-label={t.choose}>
                {result.candidates.map((candidate) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={candidate.id}
                    onClick={() => onExecute([candidate.action], `${candidate.label} · ${candidate.detail}`)}
                  >
                    <strong>{candidate.label}</strong><span>{candidate.detail}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(result.kind === 'unsupported' || result.kind === 'invalid') && (
            <p className={styles.rejection} role="alert" data-kind={result.kind} data-testid={`ask-${result.kind}`}>
              <span aria-hidden="true">{result.kind === 'unsupported' ? '×' : '!'}</span>{result.summary}
            </p>
          )}
        </div>

        <footer>{t.boundary}</footer>
      </section>
    </div>
  )
}
