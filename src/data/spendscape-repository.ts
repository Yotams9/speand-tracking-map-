import { canonicalSpendscapeData } from './spendscape-fixtures'
import {
  type GlobePurchase,
  type LocalizedText,
  type Merchant,
  type Place,
  type PurchaseEvidence,
  type SmartInboxCase,
} from './spendscape-globe'

export type SpendscapeRepositoryAdapter = 'fixture' | 'backend'

export interface SpendscapeProfileSnapshot {
  id: string
  name: LocalizedText
  baseCurrency: 'ILS'
  timezone: string
}

/**
 * The serializable, provider-neutral graph consumed by the application.
 * Transport, authentication, caching, and mutation contracts are deliberately
 * outside this Phase 2A.1 boundary.
 */
export interface SpendscapeDataSnapshot {
  source: {
    adapter: SpendscapeRepositoryAdapter
    classification: 'synthetic' | 'real'
    version: string
  }
  profile: SpendscapeProfileSnapshot
  merchants: readonly Merchant[]
  places: readonly Place[]
  purchases: readonly GlobePurchase[]
  evidence: readonly PurchaseEvidence[]
  smartInboxCases: readonly SmartInboxCase[]
}

/** Server-side loading boundary. Only the returned plain snapshot crosses to UI. */
export interface SpendscapeDataRepository {
  readonly adapter: SpendscapeRepositoryAdapter
  loadSnapshot(): Promise<SpendscapeDataSnapshot>
}

const fixtureSnapshot: SpendscapeDataSnapshot = {
  source: {
    adapter: 'fixture',
    classification: canonicalSpendscapeData.fixtureKind,
    version: canonicalSpendscapeData.fixtureVersion,
  },
  profile: canonicalSpendscapeData.profile,
  merchants: canonicalSpendscapeData.merchants,
  places: canonicalSpendscapeData.places,
  purchases: canonicalSpendscapeData.purchases,
  evidence: canonicalSpendscapeData.evidence,
  smartInboxCases: canonicalSpendscapeData.smartInboxCases,
}

export function createFixtureSpendscapeRepository(): SpendscapeDataRepository {
  return {
    adapter: 'fixture',
    async loadSnapshot() {
      return fixtureSnapshot
    },
  }
}

export const fixtureSpendscapeRepository = createFixtureSpendscapeRepository()
