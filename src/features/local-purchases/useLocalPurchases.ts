'use client'
import { DEVICE_LEDGER_KEY, LegacyLedgerError, readLegacyMain } from '../capture/session-purchase-storage'
import { useEffect, useRef, useState } from 'react'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import type { SessionPurchaseLedger } from '../capture/session-purchase-domain'
import type { SmartInboxDecision } from '../inbox/smart-inbox-domain'
import { emptyLocalPurchases, emptyRestoreDestination, LOCAL_CHANNEL, LocalStoreError, readLocalPurchases, restoreLocalPurchases, writeLocalPurchases, type LocalPurchases } from './local-purchase-store'
import { exportPurchaseBackup, inspectPurchaseBackup, PurchaseBackupError } from './purchase-backup'

export function useLocalPurchases(context: SpendscapeDataSnapshot, onRestore: (data: LocalPurchases) => void) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'invalid' | 'unavailable' | 'conflict'>('loading')
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState(false)
  const lastFailure = useRef<'capacity' | 'storage'>('storage')
  const legacySource = useRef<string | null>(null)
  const current = useRef(emptyLocalPurchases()), lock = useRef(false), alive = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null), restore = useRef(onRestore)
  restore.current = onRestore
  useEffect(() => {
    let active = true
    alive.current = true
    const check = async (initial = false) => {
      const revisionAtStart = current.current.revision
      try {
        const data = await readLocalPurchases(context)
        // Hydrate both ledgers without writes. A changed legacy source requires
        // reconciliation; never replace an archived ledger or merge by guessed IDs.
        const source = localStorage.getItem(DEVICE_LEDGER_KEY)
        if (!initial && source !== legacySource.current) throw new LocalStoreError('conflict')
        const legacy = readLegacyMain(source, context)
        if (initial) legacySource.current = source
        if (legacy && data.legacyMain && JSON.stringify(legacy) !== JSON.stringify(data.legacyMain)) throw new LocalStoreError('conflict')
        if (legacy && !data.legacyMain) data.legacyMain = legacy
        if (!active) return
        if (initial) { current.current = data; restore.current(data); setPhase('ready') }
        else if (!lock.current && revisionAtStart === current.current.revision && data.revision !== current.current.revision) setPhase('conflict')
      } catch (e) { if (active && !lock.current) setPhase(e instanceof LegacyLedgerError ? 'invalid' : e instanceof LocalStoreError && (e.code === 'invalid' || e.code === 'conflict') ? e.code : 'unavailable') }
    }
    void check(true)
    try {
      channel.current = new BroadcastChannel(LOCAL_CHANNEL)
      channel.current.onmessage = () => { void check() }
    } catch { /* Focus check and atomic revision check still protect writes. */ }
    const focus = () => { void check() }
    window.addEventListener('focus', focus)
    window.addEventListener('storage', focus)
    return () => { active = false; alive.current = false; channel.current?.close(); channel.current = null; window.removeEventListener('focus', focus); window.removeEventListener('storage', focus) }
  }, [context])
  const commit = async (ledger: SessionPurchaseLedger, decisions: readonly SmartInboxDecision[], erase = false) => {
    if (lock.current || (!erase && phase !== 'ready')) return false
    lock.current = true; lastFailure.current = 'storage'; setBusy(true); setWriteError(false)
    try {
      if (localStorage.getItem(DEVICE_LEDGER_KEY) !== legacySource.current) throw new LocalStoreError('conflict')
      if (erase && current.current.legacyMain) throw new LocalStoreError('rejected')
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
      if (localStorage.getItem(DEVICE_LEDGER_KEY) !== legacySource.current) { setPhase('conflict'); throw new PurchaseBackupError('conflict') }
      const saved = await readLocalPurchases(context)
      if (saved.revision !== current.current.revision) { setPhase('conflict'); throw new PurchaseBackupError('conflict') }
      return await exportPurchaseBackup({ ...saved, legacyMain: current.current.legacyMain ?? null }, context)
    } catch (error) {
      if (error instanceof PurchaseBackupError) throw error
      throw new PurchaseBackupError('storage')
    }
  }
  const restoreBackup = async (data: LocalPurchases) => {
    if (lock.current || phase !== 'ready') throw new PurchaseBackupError('unavailable')
    if (!emptyRestoreDestination(current.current)) throw new PurchaseBackupError('not-empty')
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
  return { phase, busy, writeError, lastFailure, commit, exportBackup, restoreBackup, inspectBackup: (text: string) => inspectPurchaseBackup(text, context), legacyPresent: Boolean(current.current.legacyMain), emptyDestination: emptyRestoreDestination(current.current) }
}
