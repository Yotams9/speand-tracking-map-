/**
 * Locale plumbing.
 *
 * English (LTR) is the default. Hebrew is optional and flips `dir` on the
 * document element, which is what every layout in this app reacts to — the CSS
 * uses logical properties throughout, so nothing needs mirroring by hand.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { strings, type StringKey } from './strings'
import { fixtures } from '@/data/fixtures'
import type { Localized } from '@/data/types'

export type Lang = 'en' | 'he'

interface LocaleValue {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (lang: Lang) => void
  /** Look up a UI string, with optional {placeholder} substitution. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** Read the active language out of a piece of fixture data. */
  L: (value: Localized | null | undefined) => string
  money: (amount: number, opts?: { decimals?: boolean }) => string
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string
  time: (iso: string) => string
  weekday: (index: number) => string
  /** Picks a singular or plural string and fills in the localized count. */
  plural: (n: number, one: StringKey, many: StringKey) => string
  relativeDay: (iso: string) => string
  number: (n: number, decimals?: number) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)

const LOCALE_TAG: Record<Lang, string> = { en: 'en-IL', he: 'he-IL' }

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  const dir: 'ltr' | 'rtl' = lang === 'he' ? 'rtl' : 'ltr'

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = dir
  }, [lang, dir])

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) =>
      interpolate(strings[key][lang], vars),
    [lang],
  )

  const L = useCallback(
    (value: Localized | null | undefined) => (value ? value[lang] : ''),
    [lang],
  )

  const money = useCallback(
    (amount: number, opts?: { decimals?: boolean }) => {
      const decimals = opts?.decimals ?? true
      return new Intl.NumberFormat(LOCALE_TAG[lang], {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0,
      }).format(amount)
    },
    [lang],
  )

  const date = useCallback(
    (iso: string, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(
        LOCALE_TAG[lang],
        opts ?? { day: 'numeric', month: 'short' },
      ).format(new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)),
    [lang],
  )

  const time = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(LOCALE_TAG[lang], {
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(iso)),
    [lang],
  )

  const weekday = useCallback(
    (index: number) => {
      // 2026-03-01 was a Sunday, giving a stable anchor for weekday names.
      const anchor = new Date(2026, 2, 1 + index)
      return new Intl.DateTimeFormat(LOCALE_TAG[lang], { weekday: 'long' }).format(anchor)
    },
    [lang],
  )

  const numberFmt = useCallback(
    (n: number, decimals = 0) =>
      new Intl.NumberFormat(LOCALE_TAG[lang], {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      }).format(n),
    [lang],
  )

  const plural = useCallback(
    (n: number, one: StringKey, many: StringKey) =>
      interpolate(strings[n === 1 ? one : many][lang], { n: numberFmt(n) }),
    [lang, numberFmt],
  )

  const relativeDay = useCallback(
    (iso: string) => {
      const days = Math.round(
        (new Date(`${fixtures.demoToday}T12:00:00`).getTime() -
          new Date(iso.slice(0, 10) + 'T12:00:00').getTime()) / 86_400_000,
      )
      if (days === 0) return strings['common.today'][lang]
      if (days === 1) return strings['common.yesterday'][lang]
      return new Intl.RelativeTimeFormat(LOCALE_TAG[lang], { numeric: 'auto' }).format(-days, 'day')
    },
    [lang],
  )

  const value = useMemo<LocaleValue>(
    () => ({
      lang, dir, setLang, t, L, money, date, time, weekday, relativeDay,
      number: numberFmt, plural,
    }),
    [lang, dir, t, L, money, date, time, weekday, relativeDay, numberFmt, plural],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}
