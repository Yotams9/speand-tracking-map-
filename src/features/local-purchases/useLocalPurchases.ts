'use client'
import { useEffect, useRef, useState } from 'react'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import type { SessionPurchaseLedger } from '../capture/session-purchase-domain'
import type { SmartInboxDecision } from '../inbox/smart-inbox-domain'
import { emptyLocalPurchases, emptyRestoreDestination, LOCAL_CHANNEL, LocalStoreError, readLocalPurchases, restoreLocalPurchases, writeLocalPurchases, type LocalPurchases } from './local-purchase-store'
import { exportPurchaseBackup, inspectPurchaseBackup, PurchaseBackupError } from './purchase-backup'
import { migrateLegacyPurchases, skipLegacyImport, type LegacyMigrationOutcome } from './legacy-device-migration'
import { loadCatalogStores } from '../capture/catalog-stores'

export function useLocalPurchases(context: SpendscapeDataSnapshot, onRestore: (data: LocalPurchases) => void) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'invalid' | 'unavailable' | 'conflict'>('loading')
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState(false)
  const [migration, setMigration] = useState<LegacyMigrationOutcome | null>(null)
  const [importing, setImporting] = useState(false)
  const lastFailure = useRef<'capacity' | 'storage'>('storage')
  const current = useRef(emptyLocalPurchases()), lock = useRef(false), alive = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null), restore = useRef(onRestore)
  restore.current = onRestore
  const preferences = () => { try { return window.localStorage } catch { return null } }
  // One-time import of the earlier localStorage ledger, only into an empty store.
  // The UI stays inert (phase 'loading') until this settles. If the published
  // store list is unavailable it stays so, with the store empty, until the person
  // retries or continues without importing.
  const importLegacy = async (start: LocalPurchases, live: () => boolean) => {
    let data = start
    const migrated = await migrateLegacyPurchases({ storage: preferences(), current: data, context, loadStores: loadCatalogStores, restore: next => restoreLocalPurchases(next, context, data.revision) })
    if (!live()) return
    if (migrated.outcome.status === 'catalog-unavailable') { current.current = data; setMigration(migrated.outcome); return }
    if (migrated.saved) { data = migrated.saved; try { channel.current?.postMessage({ changed: true }) } catch { /* No purchase data in notifications. */ } }
    // Another tab may have written meanwhile: never present the pre-import snapshot as current.
    else if (migrated.outcome.status === 'skipped-not-empty' || migrated.outcome.status === 'deferred') data = await readLocalPurchases(context)
    if (!live()) return
    setMigration(migrated.outcome)
    current.current = data; restore.current(data); setPhase('ready')
  }
  const pendingImport = async (step: () => Promise<void>) => {
    if (lock.current || migration?.status !== 'catalog-unavailable') return
    lock.current = true; setImporting(true)
    try { await step() }
    catch (e) { if (alive.current) setPhase(e instanceof LocalStoreError && e.code === 'invalid' ? 'invalid' : 'unavailable') }
    finally { lock.current = false; if (alive.current) setImporting(false) }
  }
  const retryMigration = () => pendingImport(async () => importLegacy(await readLocalPurchases(context), () => alive.current))
  const continueWithoutImport = () => pendingImport(async () => {
    const outcome = skipLegacyImport(preferences(), migration?.status === 'catalog-unavailable' ? migration.legacyPurchases : 0)
    const data = await readLocalPurchases(context)
    if (!alive.current) return
    setMigration(outcome)
    current.current = data; restore.current(data); setPhase('ready')
  })
  useEffect(() => {
    let active = true
    alive.current = true
    const check = async (initial = false) => {
      const revisionAtStart = current.current.revision
      try {
        const data = await readLocalPurchases(context)
        if (!active) return
        if (initial) await importLegacy(data, () => active)
        else if (!lock.current && revisionAtStart === current.current.revision && data.revision !== current.current.revision) setPhase('conflict')
      } catch (e) { if (active && !lock.current) setPhase(e instanceof LocalStoreError && e.code === 'invalid' ? 'invalid' : 'unavailable') }
    }
    void check(true)
    try {
      channel.current = new BroadcastChannel(LOCAL_CHANNEL)
      channel.current.onmessage = () => { void check() }
    } catch { /* Focus check and atomic revision check still protect writes. */ }
    const focus = () => { void check() }
    window.addEventListener('focus', focus)
    return () => { active = false; alive.current = false; channel.current?.close(); channel.current = null; window.removeEventListener('focus', focus) }
  }, [context])
  const commit = async (ledger: SessionPurchaseLedger, decisions: readonly SmartInboxDecision[], erase = false) => {
    if (lock.current || (!erase && phase !== 'ready')) return false
    lock.current = true; lastFailure.current = 'storage'; setBusy(true); setWriteError(false)
    try {
      const next = { ...current.current, directory: ledger.directory, records: ledger.records, nextSequence: ledger.nextSequence, decisions }
      const saved = await writeLocalPurchases(next, context, erase)
      current.current = saved
      try { channel.current?.postMessage({ changed: true }) } catch { /* No data in notifications. */ }
      return alive.current
    } catch (e) {
      if (alive.current) {
        lastFailure.current = e instanceof LocalStoreError && e.code === 'capacity' ? 'capacity' : 'storage'
        setWriteError(true)
        if (e instanceof LocalStoreError && (e.code === 'conflict' || e.code === 'invalid')) setPhase(e.code)
      }
      return false
    } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const exportBackup = async () => {
    if (lock.current || phase !== 'ready') throw new PurchaseBackupError('unavailable')
    try {
      const saved = await readLocalPurchases(context)
      if (saved.revision !== current.current.revision) { setPhase('conflict'); throw new PurchaseBackupError('conflict') }
      return await exportPurchaseBackup(saved, context)
    } catch (error) {
      if (error instanceof PurchaseBackupError) throw error
      throw new PurchaseBackupError('storage')
    }
  }
  const restoreBackup = async (data: LocalPurchases) => {
    if (lock.current || phase !== 'ready') throw new PurchaseBackupError('unavailable')
    lock.current = true; setBusy(true)
    try {
      const saved = await restoreLocalPurchases(data, context, current.current.revision)
      current.current = saved
      restore.current(saved)
      try { channel.current?.postMessage({ changed: true }) } catch { /* No purchase data in notifications. */ }
    } catch (error) {
      throw new PurchaseBackupError(error instanceof LocalStoreError && error.code === 'not-empty' ? 'not-empty' : error instanceof LocalStoreError && error.code === 'conflict' ? 'conflict' : 'storage')
    } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return { phase, busy, writeError, lastFailure, migration, importing, retryMigration, continueWithoutImport, commit, exportBackup, restoreBackup, inspectBackup: (text: string) => inspectPurchaseBackup(text, context), emptyDestination: emptyRestoreDestination(current.current) }
}
