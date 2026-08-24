/**
 * Application state.
 *
 * Small enough that a reducer and a context are the right tools; a state
 * library would be scaffolding for its own sake.
 *
 * Everything here lives in the tab and disappears on reload. That is a
 * deliberate property of the demo, not a missing feature: no synthetic
 * purchase should outlive the session that created it, and there is nowhere
 * for real data to accumulate.
 */

import {
  createContext, useCallback, useContext, useMemo, useReducer, type ReactNode,
} from 'react'
import { fixtures } from '@/data/fixtures'
import type { BasketEntry, CategoryId, CaptureSource, Purchase } from '@/data/types'

export type CategoryFilter = CategoryId | 'all'

interface State {
  /** Purchases logged during this session. */
  added: Purchase[]
  /** caseId -> the merchant the user picked. */
  resolved: Record<string, string>
  /**
   * The most recent resolution, kept so the offer to undo survives leaving the
   * screen. Getting one of these wrong should stay reversible for longer than
   * the two seconds a toast would give you.
   */
  lastResolved: { caseId: string; merchantId: string } | null
  /** Product ids the user dismissed from "likely needed soon". */
  dismissed: string[]
  category: CategoryFilter
}

type Action =
  | { type: 'addPurchase'; purchase: Purchase }
  | { type: 'resolveCase'; caseId: string; merchantId: string }
  | { type: 'unresolveCase'; caseId: string }
  | { type: 'dismissLastResolved' }
  | { type: 'dismissNeeded'; productId: string }
  | { type: 'restoreNeeded'; productId: string }
  | { type: 'setCategory'; category: CategoryFilter }

const initial: State = {
  added: [], resolved: {}, lastResolved: null, dismissed: [], category: 'all',
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addPurchase':
      return { ...state, added: [...state.added, action.purchase] }

    case 'resolveCase':
      return {
        ...state,
        resolved: { ...state.resolved, [action.caseId]: action.merchantId },
        lastResolved: { caseId: action.caseId, merchantId: action.merchantId },
      }

    case 'unresolveCase': {
      const next = { ...state.resolved }
      delete next[action.caseId]
      return {
        ...state,
        resolved: next,
        lastResolved:
          state.lastResolved?.caseId === action.caseId ? null : state.lastResolved,
      }
    }

    case 'dismissLastResolved':
      return { ...state, lastResolved: null }

    case 'dismissNeeded':
      return state.dismissed.includes(action.productId)
        ? state
        : { ...state, dismissed: [...state.dismissed, action.productId] }

    case 'restoreNeeded':
      return { ...state, dismissed: state.dismissed.filter((id) => id !== action.productId) }

    case 'setCategory':
      return { ...state, category: action.category }
  }
}

interface AppValue extends State {
  /**
   * Session purchases in the shape the derivation layer expects: anything the
   * user logged, plus resolved copies of ambiguous purchases.
   *
   * A resolved copy carries the same id as the original. The original is
   * filtered out by `resolvedPurchases` because it is still marked ambiguous,
   * so exactly one version of each purchase ever reaches a screen.
   */
  extra: Purchase[]
  openCases: typeof fixtures.ambiguityCases
  addPurchase: (input: {
    merchantId: string
    items: BasketEntry[]
    flatTotal?: number
    source: CaptureSource
  }) => Purchase
  resolveCase: (caseId: string, merchantId: string) => void
  unresolveCase: (caseId: string) => void
  dismissLastResolved: () => void
  dismissNeeded: (productId: string) => void
  restoreNeeded: (productId: string) => void
  setCategory: (category: CategoryFilter) => void
}

const AppContext = createContext<AppValue | null>(null)

/** Session-local ids, so an added purchase is never confused with a fixture. */
let seq = 0
const nextId = () => `pu_new_${++seq}`

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const extra = useMemo<Purchase[]>(() => {
    const resolvedCopies: Purchase[] = []
    for (const [caseId, merchantId] of Object.entries(state.resolved)) {
      const kase = fixtures.ambiguityCases.find((c) => c.id === caseId)
      if (!kase) continue
      const original = fixtures.purchases.find((p) => p.id === kase.purchaseId)
      if (!original) continue
      resolvedCopies.push({ ...original, merchantId, matchState: 'confirmed' })
    }
    return [...state.added, ...resolvedCopies]
  }, [state.added, state.resolved])

  const openCases = useMemo(
    () => fixtures.ambiguityCases.filter((c) => !(c.id in state.resolved)),
    [state.resolved],
  )

  const addPurchase = useCallback<AppValue['addPurchase']>((input) => {
    // Stamped at the demo's fixed "today" so the new purchase sits alongside
    // the fixtures rather than jumping to a real wall-clock date.
    const purchase: Purchase = {
      id: nextId(),
      merchantId: input.merchantId,
      timestamp: `${fixtures.demoToday}T12:00`,
      captureSource: input.source,
      matchState: 'confirmed',
      items: input.items,
      ...(input.flatTotal !== undefined ? { flatTotal: input.flatTotal } : {}),
    }
    dispatch({ type: 'addPurchase', purchase })
    return purchase
  }, [])

  const value = useMemo<AppValue>(
    () => ({
      ...state,
      extra,
      openCases,
      addPurchase,
      resolveCase: (caseId, merchantId) => dispatch({ type: 'resolveCase', caseId, merchantId }),
      unresolveCase: (caseId) => dispatch({ type: 'unresolveCase', caseId }),
      dismissLastResolved: () => dispatch({ type: 'dismissLastResolved' }),
      dismissNeeded: (productId) => dispatch({ type: 'dismissNeeded', productId }),
      restoreNeeded: (productId) => dispatch({ type: 'restoreNeeded', productId }),
      setCategory: (category) => dispatch({ type: 'setCategory', category }),
    }),
    [state, extra, openCases, addPurchase],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppStateProvider>')
  return ctx
}
